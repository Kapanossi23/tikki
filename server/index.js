const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3001);
const PASSWORD = process.env.TIKKI_PASSWORD || 'Tikkijumala';
const NAMES = ['Hate', 'Kapa', 'Mane', 'Jere'];
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const rankValue = Object.fromEntries(ranks.map((r, i) => [r, i]));
const rooms = new Map();

const deck = () => suits.flatMap(s => ranks.map(r => ({ id: `${r}${s}`, rank: r, suit: s })));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const compare = (a, b) => rankValue[a.rank] - rankValue[b.rank] || suits.indexOf(a.suit) - suits.indexOf(b.suit);
const cardPool = p => [...p.hand, ...p.table];

function newRoom() {
  let code;
  do code = crypto.randomBytes(3).toString('hex').toUpperCase(); while (rooms.has(code));
  const r = { code, players: [null, null, null, null], scores: [0, 0], round: 1, leader: 0, trickNo: 1, trick: [], status: 'lobby', lastResult: null, roundWinner: null, gameWinner: null, pairing: null, pendingTwoStop: null, nextRoundTimer: null };
  rooms.set(code, r);
  return r;
}

function publicState(r) {
  return {
    code: r.code,
    status: r.status,
    round: r.round,
    scores: r.scores,
    players: r.players.map(p => p ? { name: p.name, seat: p.seat, connected: p.connected, team: p.team } : null),
    leader: r.leader,
    trickNo: r.trickNo,
    trick: r.trick.map(x => ({ seat: x.seat, card: x.card })),
    lastResult: r.lastResult,
    roundWinner: r.roundWinner,
    gameWinner: r.gameWinner,
    pendingTwoStop: r.pendingTwoStop ? { seat: r.pendingTwoStop.seat } : null,
    pairing: r.pairing
  };
}

function stateFor(r, socketId) {
  const state = publicState(r);
  state.self = r.players.find(p => p?.socketId === socketId)?.seat ?? null;
  state.hands = r.players.map(p => p ? {
    seat: p.seat,
    name: p.name,
    table: p.table,
    hand: p.socketId === socketId ? p.hand : p.hand.map(c => ({ id: c.id, hidden: true }))
  } : null);
  return state;
}

function broadcast(r) {
  r.players.forEach(p => { if (p) io.to(p.socketId).emit('state', stateFor(r, p.socketId)); });
}

function assignTeams(r) {
  // A separate 4-card draw determines pairs; the gameplay deck is then freshly shuffled.
  const draw = shuffle(deck()).slice(0, 4);
  const order = [0, 1, 2, 3].sort((a, b) => compare(draw[a], draw[b]));
  const teamA = new Set([order[0], order[3]]);
  r.players.forEach((p, i) => p.team = teamA.has(i) ? 0 : 1);
  r.pairing = draw.map((card, seat) => ({ seat, card, team: r.players[seat].team }));
  r.leader = order[3];
}

function dealRound(r) {
  const d = shuffle(deck());
  r.players.forEach((p, i) => {
    p.hand = d.slice(i * 8, i * 8 + 5);
    p.table = d.slice(i * 8 + 5, i * 8 + 8);
  });
  r.trick = [];
  r.trickNo = 1;
  r.lastResult = null;
  r.roundWinner = null;
  r.pendingTwoStop = null;
  r.status = 'playing';
}

function canPlay(r, p, card) {
  if (!card) return false;
  if (!r.trick.length) return true;
  const lead = r.trick[0].card.suit;
  const hasLead = cardPool(p).some(c => c.suit === lead);
  return hasLead ? card.suit === lead : true;
}

function removeCard(p, id) {
  let i = p.hand.findIndex(c => c.id === id);
  if (i >= 0) return p.hand.splice(i, 1)[0];
  i = p.table.findIndex(c => c.id === id);
  if (i >= 0) return p.table.splice(i, 1)[0];
  return null;
}

function othersHaveNoSuit(r, seat, suit) {
  return r.players.every((p, i) => i === seat || !cardPool(p).some(c => c.suit === suit));
}

function firstTwoStopCandidate(r, seat, played) {
  if (played.rank !== '2') return false;
  const p = r.players[seat];
  const remaining = cardPool(p);
  if (remaining.length !== 1) return false;
  const last = remaining[0];
  return last.rank === '2' && last.suit !== played.suit && othersHaveNoSuit(r, seat, played.suit);
}

function secondTwoStopCandidate(r, seat, played) {
  const pending = r.pendingTwoStop;
  return !!pending && pending.seat === seat && played.rank === '2' && played.suit === pending.secondSuit && othersHaveNoSuit(r, seat, played.suit);
}

function finishTrick(r) {
  const lead = r.trick[0].card.suit;
  const eligible = r.trick.filter(x => x.card.suit === lead);
  const winner = eligible.reduce((a, b) => compare(a.card, b.card) > 0 ? a : b);
  if (r.trickNo === 8) {
    const points = winner.card.rank === '2' ? 2 : 1;
    r.scores[r.players[winner.seat].team] += points;
    r.roundWinner = { seat: winner.seat, team: r.players[winner.seat].team, points, card: winner.card };
    if (r.scores[r.players[winner.seat].team] >= 5) {
      r.status = 'gameover';
      r.gameWinner = r.players[winner.seat].team;
      return;
    }
    r.status = 'roundEnd';
    r.round++;
    r.leader = winner.seat;
    clearTimeout(r.nextRoundTimer);
    r.nextRoundTimer = setTimeout(() => { if (rooms.has(r.code) && r.status === 'roundEnd') { dealRound(r); broadcast(r); } }, 2800);
    return;
  }
  r.lastResult = { seat: winner.seat, card: winner.card };
  r.trick = [];
  r.trickNo += 1;
  r.leader = winner.seat;
}

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {
  socket.on('login', (data, cb) => {
    if (!NAMES.includes(data?.name) || data?.password !== PASSWORD) return cb({ ok: false, error: 'Väärä nimi tai salasana.' });
    socket.data.name = data.name;
    cb({ ok: true });
  });

  socket.on('createRoom', cb => {
    if (!socket.data.name) return cb({ ok: false, error: 'Kirjaudu ensin.' });
    const r = newRoom();
    joinRoom(r, socket);
    cb({ ok: true, code: r.code });
  });

  socket.on('joinRoom', (data, cb) => {
    if (!socket.data.name) return cb({ ok: false, error: 'Kirjaudu ensin.' });
    const r = rooms.get(String(data?.code || '').trim().toUpperCase());
    if (!r) return cb({ ok: false, error: 'Peliä ei löydy.' });
    if (r.status !== 'lobby') return cb({ ok: false, error: 'Peli on jo alkanut.' });
    if (r.players.some(p => p?.name === socket.data.name)) return cb({ ok: false, error: 'Nimi on jo käytössä tässä pelissä.' });
    if (r.players.filter(Boolean).length >= 4) return cb({ ok: false, error: 'Peli on täynnä.' });
    joinRoom(r, socket);
    cb({ ok: true, code: r.code });
    if (r.players.every(Boolean)) { assignTeams(r); dealRound(r); broadcast(r); }
  });

  socket.on('playCard', (data, cb) => {
    const r = rooms.get(socket.data.room);
    if (!r || r.status !== 'playing') return cb?.({ ok: false, error: 'Peli ei ole käynnissä.' });
    const p = r.players.find(x => x?.socketId === socket.id);
    if (!p) return cb?.({ ok: false, error: 'Pelaajaa ei löydy.' });
    const expectedSeat = (r.leader + r.trick.length) % 4;
    if (p.seat !== expectedSeat) return cb?.({ ok: false, error: 'Odota omaa vuoroasi.' });
    const card = cardPool(p).find(c => c.id === data?.cardId);
    if (!card) return cb?.({ ok: false, error: 'Korttia ei löydy.' });
    if (!canPlay(r, p, card)) return cb?.({ ok: false, error: 'Sinun täytyy seurata maata.' });
    removeCard(p, card.id);
    r.trick.push({ seat: p.seat, card });

    if (secondTwoStopCandidate(r, p.seat, card)) {
      r.scores[p.team] += 2;
      r.roundWinner = { seat: p.seat, team: p.team, points: 2, card, special: true };
      r.status = 'gameover';
      r.gameWinner = p.team;
      r.pendingTwoStop = null;
      broadcast(r);
      return cb?.({ ok: true });
    }

    if (firstTwoStopCandidate(r, p.seat, card)) {
      r.pendingTwoStop = { seat: p.seat, firstSuit: card.suit, secondSuit: cardPool(p)[0].suit };
    } else if (r.pendingTwoStop?.seat === p.seat) {
      r.pendingTwoStop = null;
    }

    if (r.trick.length === 4) finishTrick(r);
    broadcast(r);
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const r = rooms.get(socket.data.room);
    if (!r) return;
    const p = r.players.find(x => x?.socketId === socket.id);
    if (p) p.connected = false;
    broadcast(r);
  });

  function joinRoom(r, s) {
    const seat = r.players.findIndex(x => !x);
    r.players[seat] = { socketId: s.id, name: s.data.name, seat, team: null, hand: [], table: [], connected: true };
    s.data.room = r.code;
    s.join(r.code);
    broadcast(r);
  }
});

server.on('request', (req, res) => {
  if (req.url === '/health') { res.writeHead(200, {'content-type':'application/json'}); return res.end(JSON.stringify({ ok:true, service:'tikki-server', rooms: rooms.size })); }
});

server.listen(PORT, () => console.log(`Tikki server kuuntelee portissa ${PORT}`));
