# Landing Vercel

Questo progetto e una landing marketing separata dall'app Expo.

## Struttura consigliata

- root Vercel: `landing/`
- dominio: `aiutarsi.app`
- app mobile: resta separata
- Supabase: non necessario per la prima pubblicazione

## Deploy su Vercel

1. Importa il repo in Vercel
2. Imposta `Root Directory` su `landing`
3. Framework preset: `Next.js`
4. Build command: lascia default
5. Output directory: lascia default
6. Deploy

## Quando collegare Supabase

Collegalo solo se vuoi uno di questi:

- form waitlist persistente
- richiesta demo con salvataggio lead
- area privata o CMS minimale

Per una landing di presentazione, questa versione statica basta ed e piu pulita.
