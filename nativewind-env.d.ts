/// <reference types="nativewind/types" />

// La riga sopra (catena nativewind/types -> react-native-css-interop/types)
// NON dichiara un modulo per gli import CSS: fa solo l'augmentation delle
// prop `className` sui componenti RN. La dichiarazione che rende valido
// `import "../global.css"` (app/_layout.tsx, richiesto da NativeWind v4)
// esiste solo in expo/types/global.d.ts, raggiunta transitivamente da
// expo-env.d.ts -- ma expo-env.d.ts è un file GENERATO e in .gitignore
// (rigenerato in automatico da `npx expo`/dal dev server, mai committato):
// in CI (checkout pulito + npm ci, nessun comando Expo CLI prima di tsc)
// non esiste mai, quindi `npx tsc --noEmit` falliva sempre con TS2882 pur
// passando in locale (dove il file capitava già rigenerato su disco).
// Verificato riproducendo il fallimento: rinominando expo-env.d.ts per
// simulare un checkout CI, l'errore compare identico; dichiarandolo qui
// (file effettivamente tracciato in git) sparisce anche senza expo-env.d.ts.
declare module "*.css";
