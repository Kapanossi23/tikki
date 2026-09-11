# Tikki – valmis mobiiliappi

Tämä paketti sisältää Tikki-korttipelin mobiiliapin ja reaaliaikaisen pelipalvelimen.

## Sisältö
- Expo / React Native -mobiiliappi Androidille ja iPhonelle
- Socket.IO-palvelin
- 4 pelaajaa: Hate, Kapa, Mane, Jere
- yhteinen salasana palvelimella ympäristömuuttujana
- pelihuoneet ja 6-merkkiset koodit
- 5 käsikorttia + 3 näkyvää pöytäkorttia
- pakollinen maan seuraaminen
- 8 tikkiä / kierros, piste vain 8. tikistä
- viimeisen tikin kakkonen = 2 pistettä
- kahden peräkkäisen kakkosen erikoislopetus
- mobiilipöytä, pelaajat neljässä suunnassa, vuoromerkki ja haptinen palaute

## 1. Palvelimen julkaisu
Helpoin tapa on Render tai muu Dockeria tukeva palvelu.

`server/` on itsenäinen Node-palvelu ja sisältää Dockerfilen sekä `/health`-terveystarkistuksen.

Aseta tuotantopalvelimelle:
- `TIKKI_PASSWORD` = haluamasi salasana
- `PORT` = palveluntarjoajan antama portti (jos palveluntarjoaja vaatii; oletus 3001)

Kun palvelin on verkossa, testaa:
`https://OMA-OSOITE/health`

## 2. Mobiiliapin palvelinosoite
Aseta projektin ympäristömuuttuja:
`EXPO_PUBLIC_SERVER_URL=https://OMA-TIKKI-SERVERIN-OSOITE`

Päivitä sama arvo `eas.json`-tiedostoon tuotantobuildia varten.

## 3. Kehitys
```bash
cd server
npm install
npm start
```

Toisessa terminaalissa:
```bash
npm install
npx expo start
```

## 4. Android / iPhone julkaisu
Asenna EAS CLI ja kirjaudu omalle Expo-tilillesi:
```bash
npm install
npx eas login
npx eas build:configure
```

Android:
```bash
npm run build:android
```

iPhone:
```bash
npm run build:ios
```

App Store / Google Play -julkaisu vaatii omat Apple Developer- ja Google Play Developer -tilit.

## Tärkeä tuotantohuomio
Pelihuoneet ovat tällä hetkellä palvelimen muistissa. Palvelimen uudelleenkäynnistys katkaisee käynnissä olevat pelit. Tämä on tarkoituksellisesti kevyt moninpeli-MVP; myöhemmin voidaan lisätä Redis/DB-persistointi ja reconnect-tuki.
