const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3001);
const PASSWORD = process.env.TIKKI_PASSWORD || 'Tikkijumala';

const NAMES = ['Hate', 'Kapa', 'Mane', 'Jere'];

const suits = ['♠', '♥', '♦', '♣'];
const ranks = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10',
  'J', 'Q', 'K', 'A'
];

const rankValue = Object.fromEntries(
  ranks.map((r, i) => [r, i])
);

const rooms = new Map();

const deck = () =>
  suits.flatMap(suit =>
    ranks.map(rank => ({
      id: `${rank}${suit}`,
      rank,
      suit
    }))
  );

const shuffle = array => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [
      array[j],
      array[i]
    ];
  }

  return array;
};

const compare = (a, b) =>
  rankValue[a.rank] - rankValue[b.rank] ||
  suits.indexOf(a.suit) - suits.indexOf(b.suit);

const cardPool = player => [
  ...(player.hand || []),
  ...(player.table || [])
];

function newRoom() {
  let code;

  do {
    code = crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase();
  } while (rooms.has(code));

  const room = {
    code,
    players: [null, null, null, null],
    scores: [0, 0],
    round: 1,
    leader: 0,
    trickNo: 1,
    trick: [],
    status: 'lobby',
    lastResult: null,
    roundWinner: null,
    gameWinner: null,
    pairing: null,
    pendingTwoStop: null,
    nextRoundTimer: null
  };

  rooms.set(code, room);

  return room;
}

function publicState(room) {
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    scores: room.scores,

    players: room.players.map(player =>
      player
        ? {
            name: player.name,
            seat: player.seat,
            connected: player.connected,
            team: player.team,
            table: player.table,
            played: player.played
          }
        : null
    ),

    leader: room.leader,
    trickNo: room.trickNo,

    trick: room.trick.map(item => ({
      seat: item.seat,
      card: item.card
    })),

    lastResult: room.lastResult,
    roundWinner: room.roundWinner,
    gameWinner: room.gameWinner,

    pendingTwoStop: room.pendingTwoStop
      ? {
          seat: room.pendingTwoStop.seat
        }
      : null,

    pairing: room.pairing
  };
}

function stateFor(room, socketId) {
  const state = publicState(room);

  state.self =
    room.players.find(
      player => player?.socketId === socketId
    )?.seat ?? null;

  state.hands = room.players.map(player => {
    if (!player) {
      return null;
    }

    return {
      seat: player.seat,
      name: player.name,

      table: player.table,

      played: player.played,

      hand:
        player.socketId === socketId
          ? player.hand
          : player.hand.map(card => ({
              id: card.id,
              hidden: true
            }))
    };
  });

  return state;
}

function broadcast(room) {
  room.players.forEach(player => {
    if (player) {
      io.to(player.socketId).emit(
        'state',
        stateFor(room, player.socketId)
      );
    }
  });
}

function assignTeams(room) {
  const draw = shuffle(deck()).slice(0, 4);

  const order = [0, 1, 2, 3].sort(
    (a, b) => compare(draw[a], draw[b])
  );

  const teamA = new Set([
    order[0],
    order[3]
  ]);

  room.players.forEach((player, seat) => {
    player.team = teamA.has(seat)
      ? 0
      : 1;
  });

  room.pairing = draw.map(
    (card, seat) => ({
      seat,
      card,
      team: room.players[seat].team
    })
  );

  room.leader = order[3];
}

function dealRound(room) {
  const cards = shuffle(deck());

  room.players.forEach((player, i) => {
    player.hand = cards.slice(
      i * 8,
      i * 8 + 5
    );

    player.table = cards.slice(
      i * 8 + 5,
      i * 8 + 8
    );

    player.played = [];
  });

  room.trick = [];
  room.trickNo = 1;
  room.lastResult = null;
  room.roundWinner = null;
  room.pendingTwoStop = null;
  room.status = 'playing';
}

function canPlay(room, player, card) {
  if (!card) {
    return false;
  }

  if (!room.trick.length) {
    return true;
  }

  const lead =
    room.trick[0].card.suit;

  const hasLead =
    cardPool(player).some(
      cardInHand =>
        cardInHand.suit === lead
    );

  return hasLead
    ? card.suit === lead
    : true;
}

function removeCard(player, id) {
  let index = player.hand.findIndex(
    card => card.id === id
  );

  if (index >= 0) {
    return player.hand.splice(index, 1)[0];
  }

  index = player.table.findIndex(
    card => card.id === id
  );

  if (index >= 0) {
    return player.table.splice(index, 1)[0];
  }

  return null;
}

function othersHaveNoSuit(room, seat, suit) {
  return room.players.every(
    (player, i) =>
      i === seat ||
      !cardPool(player).some(
        card => card.suit === suit
      )
  );
}

function firstTwoStopCandidate(
  room,
  seat,
  played
) {
  if (played.rank !== '2') {
    return false;
  }

  const player = room.players[seat];

  const remaining =
    cardPool(player);

  if (remaining.length !== 1) {
    return false;
  }

  const last = remaining[0];

  return (
    last.rank === '2' &&
    last.suit !== played.suit &&
    othersHaveNoSuit(
      room,
      seat,
      played.suit
    )
  );
}

function secondTwoStopCandidate(
  room,
  seat,
  played
) {
  const pending =
    room.pendingTwoStop;

  return (
    !!pending &&
    pending.seat === seat &&
    played.rank === '2' &&
    played.suit === pending.secondSuit &&
    othersHaveNoSuit(
      room,
      seat,
      played.suit
    )
  );
}

function finishTrick(room) {
  const lead =
    room.trick[0].card.suit;

  const eligible =
    room.trick.filter(
      item =>
        item.card.suit === lead
    );

  const winner =
    eligible.reduce(
      (a, b) =>
        compare(a.card, b.card) > 0
          ? a
          : b
    );

  if (room.trickNo === 8) {
    const points =
      winner.card.rank === '2'
        ? 2
        : 1;

    room.scores[
      room.players[winner.seat].team
    ] += points;

    room.roundWinner = {
      seat: winner.seat,
      team:
        room.players[winner.seat].team,
      points,
      card: winner.card
    };

    if (
      room.scores[
        room.players[winner.seat].team
      ] >= 5
    ) {
      room.status = 'gameover';

      room.gameWinner =
        room.players[winner.seat].team;

      return;
    }

    room.status = 'roundEnd';

    room.round += 1;

    room.leader = winner.seat;

    clearTimeout(
      room.nextRoundTimer
    );

    room.nextRoundTimer =
      setTimeout(() => {
        if (
          rooms.has(room.code) &&
          room.status === 'roundEnd'
        ) {
          dealRound(room);

          broadcast(room);
        }
      }, 2800);

    return;
  }

  room.lastResult = {
    seat: winner.seat,
    card: winner.card
  };

  room.trick = [];

  room.trickNo += 1;

  room.leader = winner.seat;
}

const server = http.createServer();

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', socket => {

  socket.on('login', (data, cb) => {
    if (
