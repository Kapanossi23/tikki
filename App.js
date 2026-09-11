import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { io } from 'socket.io-client';

const SERVER_URL = 'https://tikki-ipp5.onrender.com';

const NAMES = ['Hate', 'Kapa', 'Mane', 'Jere'];

const SUIT_COLOR = {
  '♥': '#d83b56',
  '♦': '#d83b56',
  '♠': '#101820',
  '♣': '#101820',
};

const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket'],
});

export default function App() {
  const [screen, setScreen] = useState('login');
  const [name, setName] = useState(NAMES[0]);
  const [password, setPassword] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [game, setGame] = useState(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const onState = next => {
      setGame(next);
      setConnected(true);

      if (next.status === 'lobby') {
        setScreen('room');
      } else {
        setScreen('game');
      }
    };

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const login = () => {
    if (!password.trim()) {
      return Alert.alert('Salasana', 'Anna salasana.');
    }

    setBusy(true);

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('login', { name, password }, res => {
      setBusy(false);

      if (!res?.ok) {
        return Alert.alert(
          'Kirjautuminen',
          res?.error || 'Kirjautuminen epäonnistui.'
        );
      }

      setScreen('lobby');
    });
  };

  const createRoom = () => {
    socket.emit('createRoom', res => {
      if (res?.ok) {
        setRoomCode(res.code);
        setScreen('room');
      } else {
        Alert.alert('Virhe', res?.error || 'Huonetta ei voitu luoda.');
      }
    });
  };

  const joinRoom = () => {
    socket.emit(
      'joinRoom',
      { code: roomCode.trim().toUpperCase() },
      res => {
        if (res?.ok) {
          setRoomCode(res.code);
          setScreen('room');
        } else {
          Alert.alert(
            'Virhe',
            res?.error || 'Peliin liittyminen epäonnistui.'
          );
        }
      }
    );
  };

  if (screen === 'login') {
    return (
      <LoginScreen
        name={name}
        setName={setName}
        password={password}
        setPassword={setPassword}
        login={login}
        busy={busy}
        connected={connected}
      />
    );
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen
        createRoom={createRoom}
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        joinRoom={joinRoom}
      />
    );
  }

  if (screen === 'room') {
    return <RoomScreen game={game} roomCode={roomCode} />;
  }

  return <GameScreen game={game} myName={name} />;
}

function LoginScreen({
  name,
  setName,
  password,
  setPassword,
  login,
  busy,
  connected,
}) {
  return (
    <Page>
      <View style={styles.logoWrap}>
        <View style={styles.logoCard}>
          <Text style={styles.logoRank}>A</Text>
          <Text style={styles.logoSuit}>♥</Text>
        </View>

        <Text style={styles.logo}>TIKKI</Text>
        <Text style={styles.subtitle}>Kaveriporukan korttipeli</Text>
      </View>

      <Text style={styles.label}>PELAAJA</Text>

      <View style={styles.nameGrid}>
        {NAMES.map(n => (
          <Pressable
            key={n}
            onPress={() => setName(n)}
            style={[
              styles.nameBtn,
              name === n && styles.nameBtnOn,
            ]}
          >
            <Text
              style={[
                styles.nameText,
                name === n && styles.nameTextOn,
              ]}
            >
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Salasana"
        placeholderTextColor="#7c8da4"
        style={styles.input}
      />

      <PrimaryButton
        title={busy ? 'Yhdistetään…' : 'Kirjaudu'}
        onPress={login}
        disabled={busy}
      />

      <View style={styles.serverStatus}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: connected
                ? '#41d99a'
                : '#f0a34b',
            },
          ]}
        />

        <Text style={styles.serverText}>
          {connected
            ? 'Palvelin yhteydessä'
            : 'Palvelin yhdistyy kirjautuessa'}
        </Text>
      </View>

      <Text style={styles.note}>
        Pelaajat: Hate, Kapa, Mane ja Jere
      </Text>
    </Page>
  );
}

function LobbyScreen({
  createRoom,
  roomCode,
  setRoomCode,
  joinRoom,
}) {
  return (
    <Page>
      <Text style={styles.eyebrow}>PELIHUONE</Text>

      <Text style={styles.h1}>Miten pelataan?</Text>

      <Text style={styles.body}>
        Luo huone ja lähetä kuusinumeroinen koodi kavereille.
        Kun neljä pelaajaa on mukana, peli alkaa automaattisesti.
      </Text>

      <PrimaryButton
        title="Luo uusi peli"
        onPress={createRoom}
      />

      <View style={styles.orRow}>
        <View style={styles.rule} />
        <Text style={styles.or}>TAI</Text>
        <View style={styles.rule} />
      </View>

      <TextInput
        value={roomCode}
        onChangeText={setRoomCode}
        autoCapitalize="characters"
        maxLength={6}
        placeholder="Syötä pelikoodi"
        placeholderTextColor="#7c8da4"
        style={[
          styles.input,
          styles.codeInput,
        ]}
      />

      <SecondaryButton
        title="Liity peliin"
        onPress={joinRoom}
      />
    </Page>
  );
}

function RoomScreen({ game, roomCode }) {
  const code = game?.code || roomCode;
  const players = game?.players || [];

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert(
      'Kopioitu',
      'Pelikoodi on leikepöydällä.'
    );
  };

  return (
    <Page>
      <Text style={styles.eyebrow}>ODOTUSHUONE</Text>

      <Text style={styles.h1}>Kokoa nelikko</Text>

      <Pressable
        onPress={copy}
        style={styles.codeCard}
      >
        <Text style={styles.codeCaption}>
          PELIKOODI
        </Text>

        <Text style={styles.bigCode}>
          {code}
        </Text>

        <Text style={styles.codeTap}>
          Napauta kopioidaksesi
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>
        Pelaajat {players.filter(Boolean).length}/4
      </Text>

      {players.map((p, i) => (
        <View
          key={i}
          style={styles.playerRow}
        >
          <View
            style={[
              styles.avatar,
              !p && styles.avatarEmpty,
            ]}
          >
            <Text style={styles.avatarText}>
              {p?.name?.[0] || '+'}
            </Text>
          </View>

          <Text style={styles.playerName}>
            {p?.name || 'Odotetaan pelaajaa…'}
          </Text>

          {p && (
            <Text style={styles.ready}>✓</Text>
          )}
        </View>
      ))}

      <View style={styles.tip}>
        <Text style={styles.tipTitle}>
          Kun neljä on paikalla
        </Text>

        <Text style={styles.tipText}>
          Parit arvotaan suurimman ja pienimmän
          arvontakortin perusteella. Suurin aloittaa.
        </Text>
      </View>
    </Page>
  );
}

function GameScreen({ game, myName }) {
  const [selected, setSelected] = useState(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (game?.status === 'playing') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );

      animation.start();

      return () => animation.stop();
    }
  }, [game?.status]);

  if (!game) {
    return (
      <Page>
        <ActivityIndicator
          color="#fff"
          size="large"
        />
      </Page>
    );
  }

  const me = game.players?.find(
    p => p?.name === myName
  );

  const mine = game.hands?.find(
    x => x?.seat === me?.seat
  );

  const currentSeat =
    (game.leader + (game.trick?.length || 0)) % 4;

  const myTurn =
    game.status === 'playing' &&
    currentSeat === me?.seat;

  const all = [
    ...(mine?.hand || []),
    ...(mine?.table || []),
  ];

  const playable = card => {
    if (!myTurn) return false;

    if (!game.trick?.length) {
      return true;
    }

    const lead =
      game.trick[0].card.suit;

    const hasLead = all.some(
      c => c.suit === lead
    );

    return hasLead
      ? card.suit === lead
      : true;
  };

  const play = card => {
    if (!playable(card)) return;

    setSelected(card.id);

    Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    socket.emit(
      'playCard',
      { cardId: card.id },
      res => {
        setSelected(null);

        if (!res?.ok) {
          Alert.alert(
            'Korttia ei voi pelata',
            res?.error || 'Siirto ei onnistunut.'
          );
        }
      }
    );
  };

  const team = me?.team ?? 0;
  const opp = team ^ 1;

  const handsBySeat = {};

  (game.hands || []).forEach(player => {
    if (player) {
      handsBySeat[player.seat] = player;
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.gameTop}>
        <View>
          <Text style={styles.gameLogo}>
            TIKKI
          </Text>

          <Text style={styles.roundText}>
            Kierros {game.round} · Tikki{' '}
            {Math.min(game.trickNo || 1, 8)}/8
          </Text>
        </View>

        <View style={styles.roomBadge}>
          <Text style={styles.roomBadgeText}>
            {game.code}
          </Text>
        </View>
      </View>

      <View style={styles.scoreBar}>
        <Score
          label="ME"
          value={game.scores?.[team] || 0}
        />

        <View style={styles.vs}>
          <Text style={styles.vsText}>
            ENSIMMÄISENÄ 5
          </Text>
        </View>

        <Score
          label="HE"
          value={game.scores?.[opp] || 0}
        />
      </View>

      <View
        style={[
          styles.turnBar,
          myTurn && styles.turnBarOn,
        ]}
      >
        <Text style={styles.turnMain}>
          {game.status === 'gameover'
            ? '🏆 PELI PÄÄTTYI'
            : game.status === 'roundEnd'
            ? 'KIERROS PÄÄTTYI'
            : myTurn
            ? 'OMA VUORO'
            : `${game.players?.[currentSeat]?.name || ''} pelaa`}
        </Text>

        <Text style={styles.turnSub}>
          {game.status === 'playing'
            ? myTurn
              ? 'Valitse kortti'
              : 'Odota vuoroasi'
            : game.gameWinner != null
            ? `Joukkue ${game.gameWinner + 1} voitti`
            : ''}
        </Text>
      </View>

      <Table
        players={game.players}
        hands={handsBySeat}
        trick={game.trick}
        self={me?.seat}
      />

      {game.pairing?.length &&
      game.round === 1 ? (
        <View style={styles.pairBanner}>
          <Text style={styles.pairTitle}>
            PARIT ARVOTTU
          </Text>

          <Text style={styles.pairText}>
            Suurin + pienin ovat pari ·{' '}
            {game.players?.[game.leader]?.name} aloittaa
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.handArea}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.handTitle}>
          PÖYTÄKORTIT
        </Text>

        <View style={styles.cards}>
          {(mine?.table || []).map(card => (
            <AnimatedCard
              key={card.id}
              card={card}
              enabled={playable(card)}
              selected={selected === card.id}
              onPress={() => play(card)}
            />
          ))}
        </View>

        <Text style={styles.handTitle}>
          KÄSIKORTIT
        </Text>

        <View style={styles.cards}>
          {(mine?.hand || []).map(card => (
            <AnimatedCard
              key={card.id}
              card={card}
              enabled={playable(card)}
              selected={selected === card.id}
              onPress={() => play(card)}
            />
          ))}
        </View>

        {game.roundWinner && (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>
              {game.status === 'gameover'
                ? 'PELI PÄÄTTYI'
                : 'KIERROKSEN TULOS'}
            </Text>

            <Text style={styles.resultBody}>
              {
                game.players?.[
                  game.roundWinner.seat
                ]?.name
              } toi joukkueelle{' '}
              {game.roundWinner.points}{' '}
              {game.roundWinner.points === 1
                ? 'pisteen'
                : 'pistettä'}
              {game.roundWinner.special
                ? ' kahden kakkosen lopetuksella.'
                : '.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Table({
  players,
  hands,
  trick,
  self,
}) {
  const topSeat = (self + 2) % 4;
  const leftSeat = (self + 1) % 4;
  const rightSeat = (self + 3) % 4;

  return (
    <View style={styles.felt}>
      <PlayerTableArea
        player={players?.[topSeat]}
        data={hands?.[topSeat]}
        position="top"
      />

      <PlayerTableArea
        player={players?.[leftSeat]}
        data={hands?.[leftSeat]}
        position="left"
      />

      <PlayerTableArea
        player={players?.[rightSeat]}
        data={hands?.[rightSeat]}
        position="right"
      />

      <PlayerTableArea
        player={players?.[self]}
        data={hands?.[self]}
        position="bottom"
        me
      />

      <View style={styles.centerPile}>
        {trick?.length ? (
          trick.map((item, index) => (
            <View
              key={`${item.seat}-${item.card.id}`}
              style={[
                styles.trickCard,
                {
                  transform: [
                    {
                      rotate: `${
                        (index - 1.5) * 7
                      }deg`,
                    },
                    {
                      translateX:
                        (index - 1.5) * 28,
                    },
                    {
                      translateY:
                        index % 2 ? 8 : -4,
                    },
                  ],
                },
              ]}
            >
              <CardFace card={item.card} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyPile}>
            TIKKI
          </Text>
        )}
      </View>
    </View>
  );
}

function PlayerTableArea({
  player,
  data,
  position,
  me,
}) {
  const table = data?.table || [];
  const played = data?.played || [];

  return (
    <View
      style={[
        styles.playerArea,
        styles[`playerArea_${position}`],
      ]}
    >
      <View style={styles.playerAreaHeader}>
        <View
          style={[
            styles.seatDot,
            me && styles.seatDotMe,
          ]}
        >
          <Text style={styles.seatInitial}>
            {player?.name?.[0] || '?'}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.seatName,
            me && styles.seatNameMe,
          ]}
        >
          {player?.name || '—'}
        </Text>
      </View>

      <View style={styles.smallCards}>
        {table.map(card => (
          <MiniCard
            key={card.id}
            card={card}
          />
        ))}
      </View>

      {played.length > 0 && (
        <View style={styles.playedPile}>
          <Text style={styles.playedLabel}>
            LYÖDYT
          </Text>

          <View style={styles.playedCards}>
            {played.slice(-4).map(card => (
              <MiniCard
                key={`played-${card.id}`}
                card={card}
                small
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function MiniCard({ card, small }) {
  return (
    <View
      style={[
        styles.miniCard,
        small && styles.miniCardSmall,
      ]}
    >
      <Text
        style={[
          styles.miniRank,
          small && styles.miniRankSmall,
          {
            color: SUIT_COLOR[card.suit],
          },
        ]}
      >
        {card.rank}
      </Text>

      <Text
        style={[
          styles.miniSuit,
          small && styles.miniSuitSmall,
          {
            color: SUIT_COLOR[card.suit],
          },
        ]}
      >
        {card.suit}
      </Text>
    </View>
  );
}

function Seat({ name, position, me }) {
  return (
    <View
      style={[
        styles.seat,
        styles[`seat_${position}`],
      ]}
    >
      <View
        style={[
          styles.seatDot,
          me && styles.seatDotMe,
        ]}
      >
        <Text style={styles.seatInitial}>
          {name?.[0] || '?'}
        </Text>
      </View>

      <Text
        style={[
          styles.seatName,
          me && styles.seatNameMe,
        ]}
      >
        {name || '—'}
      </Text>
    </View>
  );
}

function Score({ label, value }) {
  return (
    <View style={styles.score}>
      <Text style={styles.scoreLabel}>
        {label}
      </Text>

      <Text style={styles.scoreValue}>
        {value}
      </Text>
    </View>
  );
}

function AnimatedCard({
  card,
  enabled,
  selected,
  onPress,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      style={[
        styles.cardButton,
        !enabled && styles.cardDisabled,
        enabled && styles.cardEnabled,
        selected && styles.cardSelected,
      ]}
    >
      <CardFace card={card} />
    </Pressable>
  );
}

function CardFace({ card }) {
  return (
    <View style={styles.cardFace}>
      <Text
        style={[
          styles.cardRank,
          {
            color: SUIT_COLOR[card.suit],
          },
        ]}
      >
        {card.rank}
      </Text>

      <Text
        style={[
          styles.cardSuit,
          {
            color: SUIT_COLOR[card.suit],
          },
        ]}
      >
        {card.suit}
      </Text>
    </View>
  );
}

function Page({ children }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.page}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primary,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.primaryText}>
        {title}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.secondary}
    >
      <Text style={styles.secondaryText}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07111d',
  },

  page: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },

  logoWrap: {
    alignItems: 'center',
    marginBottom: 42,
  },

  logoCard: {
    width: 76,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
    marginBottom: 16,
  },

  logoRank: {
    fontSize: 34,
    fontWeight: '900',
    color: '#17202b',
  },

  logoSuit: {
    fontSize: 34,
    color: '#d83b56',
    marginTop: -6,
  },

  logo: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 7,
    color: '#fff',
  },

  subtitle: {
    color: '#8292a8',
    fontSize: 14,
    marginTop: 5,
  },

  label: {
    color: '#8ea0b7',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 9,
  },

  nameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },

  nameBtn: {
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#1c2d43',
    backgroundColor: '#0d1a2a',
  },

  nameBtnOn: {
    backgroundColor: '#1b56c9',
    borderColor: '#4e86ff',
  },

  nameText: {
    color: '#91a1b7',
    fontWeight: '800',
  },

  nameTextOn: {
    color: '#fff',
  },

  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0d1a2a',
    borderWidth: 1,
    borderColor: '#1b2d43',
    color: '#fff',
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },

  primary: {
    height: 54,
    borderRadius: 15,
    backgroundColor: '#2868e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  secondary: {
    height: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2a405d',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1a2a',
  },

  secondaryText: {
    color: '#dce6f4',
    fontWeight: '900',
    fontSize: 16,
  },

  serverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 18,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  serverText: {
    color: '#687b93',
    fontSize: 11,
  },

  note: {
    color: '#4f627b',
    textAlign: 'center',
    fontSize: 11,
    marginTop: 18,
  },

  eyebrow: {
    color: '#5f83c7',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },

  h1: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 10,
  },

  body: {
    color: '#8292a8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 26,
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },

  rule: {
    flex: 1,
    height: 1,
    backgroundColor: '#182a3f',
  },

  or: {
    color: '#53677f',
    fontSize: 11,
    fontWeight: '900',
  },

  codeInput: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
  },

  codeCard: {
    backgroundColor: '#10243b',
    borderWidth: 1,
    borderColor: '#285185',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginVertical: 20,
  },

  codeCaption: {
    color: '#6e89a8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  bigCode: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 7,
    marginVertical: 5,
  },

  codeTap: {
    color: '#6d8bad',
    fontSize: 11,
  },

  sectionTitle: {
    color: '#71859e',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 9,
  },

  playerRow: {
    height: 62,
    borderRadius: 15,
    backgroundColor: '#0c1928',
    borderWidth: 1,
    borderColor: '#15283e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2459b8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarEmpty: {
    backgroundColor: '#142438',
  },

  avatarText: {
    color: '#fff',
    fontWeight: '900',
  },

  playerName: {
    color: '#e4ebf5',
    fontWeight: '800',
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
  },

  ready: {
    color: '#43d79c',
    fontSize: 20,
    fontWeight: '900',
  },

  tip: {
    marginTop: 18,
    padding: 16,
    borderRadius: 15,
    backgroundColor: '#0d241d',
    borderWidth: 1,
    borderColor: '#173f33',
  },

  tipTitle: {
    color: '#55d99c',
    fontWeight: '900',
    fontSize: 12,
  },

  tipText: {
    color: '#769887',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  gameTop: {
    paddingHorizontal: 16,
    paddingTop: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  gameLogo: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 3,
    fontSize: 22,
  },

  roundText: {
    color: '#6e829a',
    fontSize: 10,
    marginTop: 2,
  },

  roomBadge: {
    backgroundColor: '#102239',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },

  roomBadgeText: {
    color: '#8da7c7',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },

  scoreBar: {
    margin: 10,
    backgroundColor: '#0c1928',
    borderRadius: 18,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#172b43',
  },

  score: {
    alignItems: 'center',
    minWidth: 70,
  },

  scoreLabel: {
    color: '#71849b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  scoreValue: {
    color: '#fff',
    fontSize: 29,
    fontWeight: '900',
    marginTop: -1,
  },

  vs: {
    paddingHorizontal: 8,
  },

  vsText: {
    color: '#50657d',
    fontSize: 8,
    fontWeight: '900',
  },

  turnBar: {
    marginHorizontal: 10,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#0e1b2b',
    borderWidth: 1,
    borderColor: '#172d47',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  turnBarOn: {
    backgroundColor: '#14366a',
    borderColor: '#3477e8',
  },

  turnMain: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },

  turnSub: {
    color: '#91a7c1',
    fontSize: 10,
  },

  felt: {
    height: 340,
    margin: 10,
    borderRadius: 30,
    backgroundColor: '#0b543d',
    borderWidth: 3,
    borderColor: '#124e3d',
    position: 'relative',
    overflow: 'hidden',
  },

  playerArea: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },

  playerArea_top: {
    top: 7,
    left: 45,
    right: 45,
  },

  playerArea_bottom: {
    bottom: 5,
    left: 45,
    right: 45,
  },

  playerArea_left: {
    left: 5,
    top: 105,
    width: 92,
  },

  playerArea_right: {
    right: 5,
    top: 105,
    width: 92,
  },

  playerAreaHeader: {
    alignItems: 'center',
  },

  smallCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    marginTop: 3,
  },

  miniCard: {
    width: 27,
    height: 37,
    borderRadius: 5,
    backgroundColor: '#f7f8fa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d9dee5',
  },

  miniCardSmall: {
    width: 22,
    height: 30,
  },

  miniRank: {
    fontSize: 11,
    fontWeight: '900',
  },

  miniRankSmall: {
    fontSize: 9,
  },

  miniSuit: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: -2,
  },

  miniSuitSmall: {
    fontSize: 10,
  },

  playedPile: {
    marginTop: 2,
    alignItems: 'center',
  },

  playedLabel: {
    color: '#8db5a7',
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  playedCards: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 1,
  },

  seat: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },

  seat_top: {
    top: 9,
    left: 0,
    right: 0,
  },

  seat_bottom: {
    bottom: 8,
    left: 0,
    right: 0,
  },

  seat_left: {
    left: 8,
    top: 116,
  },

  seat_right: {
    right: 8,
    top: 116,
  },

  seatDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#183a50',
    borderWidth: 2,
    borderColor: '#3d6d82',
    alignItems: 'center',
    justifyContent: 'center',
  },

  seatDotMe: {
    backgroundColor: '#285fc0',
    borderColor: '#7ba8ff',
  },

  seatInitial: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },

  seatName: {
    color: '#b5d2c8',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },

  seatNameMe: {
    color: '#fff',
  },

  centerPile: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -35,
    marginTop: -48,
    width: 70,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyPile: {
    color: '#4f907b',
    fontWeight: '900',
    letterSpacing: 2,
  },

  trickCard: {
    position: 'absolute',
  },

  pairBanner: {
    marginHorizontal: 10,
    marginTop: 2,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#0e2a21',
    borderWidth: 1,
    borderColor: '#1b4a3a',
  },

  pairTitle: {
    color: '#56d69b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  pairText: {
    color: '#87aa9b',
    fontSize: 10,
    marginTop: 2,
  },

  handArea: {
    padding: 8,
    paddingBottom: 35,
  },

  handTitle: {
    color: '#748aa3',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginVertical: 8,
  },

  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  cardButton: {
    width: 58,
    height: 78,
    borderRadius: 10,
    backgroundColor: '#f6f8fa',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardEnabled: {
    borderWidth: 2,
    borderColor: '#4e8aff',
    transform: [{ translateY: -4 }],
  },

  cardSelected: {
    borderColor: '#62e3b0',
    transform: [{ translateY: -8 }],
  },

  cardDisabled: {
    opacity: 0.3,
  },

  cardFace: {
    width: 52,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f7f8fa',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardRank: {
    fontSize: 22,
    fontWeight: '900',
  },

  cardSuit: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: -5,
  },

  result: {
    marginTop: 18,
    padding: 17,
    borderRadius: 16,
    backgroundColor: '#eaf2ff',
  },

  resultTitle: {
    color: '#15233a',
    fontSize: 16,
    fontWeight: '900',
  },

  resultBody: {
    color: '#3c4d63',
    marginTop: 5,
    lineHeight: 20,
  },
});
