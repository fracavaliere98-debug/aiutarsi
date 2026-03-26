const fs = require('fs');
const path = require('path');
const { Jimp, loadFont } = require('jimp');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'assets', 'marketing', 'screens');
const FONT_WHITE = path.join(ROOT, 'node_modules', '@jimp', 'plugin-print', 'dist', 'fonts', 'open-sans', 'open-sans-32-white', 'open-sans-32-white.fnt');
const FONT_BLACK = path.join(ROOT, 'node_modules', '@jimp', 'plugin-print', 'dist', 'fonts', 'open-sans', 'open-sans-16-black', 'open-sans-16-black.fnt');

const FRAMES = [
  {
    file: 'community_gemma_header_v1.png',
    title: 'Community con Gemma',
    subtitle: 'Hero frame per ads e teaser social',
    bg: 0xf5f7ff_ff,
    primary: 0x462282_ff,
    accent: 0xcd057f_ff,
    cards: [
      { x: 84, y: 220, w: 912, h: 280, color: 0x462282_ff },
      { x: 84, y: 540, w: 912, h: 280, color: 0xffffffff },
      { x: 84, y: 850, w: 912, h: 190, color: 0xf6f0ff_ff },
    ],
  },
  {
    file: 'onboarding_intro_gemma_v1.png',
    title: 'Onboarding Intro',
    subtitle: 'Gemma accoglie il volontario',
    bg: 0xf8f9fb_ff,
    primary: 0x352f8b_ff,
    accent: 0xcd057f_ff,
    cards: [
      { x: 140, y: 180, w: 800, h: 800, color: 0xffffffff },
      { x: 210, y: 270, w: 660, h: 520, color: 0xe9e3ff_ff },
      { x: 180, y: 1090, w: 720, h: 120, color: 0x352f8b_ff },
    ],
  },
  {
    file: 'notifications_center_v1.png',
    title: 'Centro Notifiche',
    subtitle: 'Live updates, messaggi e promemoria',
    bg: 0xf6f8fc_ff,
    primary: 0x462282_ff,
    accent: 0xcd057f_ff,
    cards: [
      { x: 84, y: 180, w: 912, h: 180, color: 0x462282_ff },
      { x: 84, y: 410, w: 912, h: 220, color: 0xffffffff },
      { x: 84, y: 670, w: 912, h: 220, color: 0xffffffff },
      { x: 84, y: 930, w: 912, h: 220, color: 0xffffffff },
    ],
  },
];

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function makeImage(frame, fontWhite, fontBlack) {
  const img = new Jimp({ width: 1080, height: 1920, color: frame.bg });

  for (const card of frame.cards) {
    const block = new Jimp({ width: card.w, height: card.h, color: card.color });
    img.composite(block, card.x, card.y);
  }

  const accentBar = new Jimp({ width: 1080, height: 24, color: frame.accent });
  img.composite(accentBar, 0, 0);

  img.print({ font: fontWhite, x: 84, y: 72, text: frame.title, maxWidth: 912, maxHeight: 60 });
  img.print({ font: fontBlack, x: 84, y: 126, text: frame.subtitle, maxWidth: 912, maxHeight: 40 });
  img.print({ font: fontBlack, x: 84, y: 1820, text: frame.file, maxWidth: 912, maxHeight: 30 });

  if (frame.file === 'community_gemma_header_v1.png') {
    img.print({ font: fontWhite, x: 126, y: 258, text: 'Gemma per Sara', maxWidth: 260, maxHeight: 40 });
    img.print({ font: fontWhite, x: 126, y: 312, text: 'Da qui partirei oggi.', maxWidth: 420, maxHeight: 40 });
    img.print({ font: fontBlack, x: 126, y: 586, text: 'Voci dei volontari', maxWidth: 260, maxHeight: 30 });
    img.print({ font: fontBlack, x: 126, y: 636, text: 'Sono entrata per aiutare e sono uscita sentendomi parte di qualcosa.', maxWidth: 780, maxHeight: 80 });
  }

  if (frame.file === 'onboarding_intro_gemma_v1.png') {
    img.print({ font: fontBlack, x: 320, y: 1015, text: 'Ciao! Io sono Gemma,', maxWidth: 440, maxHeight: 40 });
    img.print({ font: fontBlack, x: 300, y: 1065, text: 'la tua assistente di bordo.', maxWidth: 480, maxHeight: 40 });
    img.print({ font: fontWhite, x: 330, y: 1126, text: 'Inizia', maxWidth: 120, maxHeight: 30 });
  }

  if (frame.file === 'notifications_center_v1.png') {
    img.print({ font: fontWhite, x: 126, y: 236, text: 'Le tue Notifiche', maxWidth: 340, maxHeight: 40 });
    img.print({ font: fontBlack, x: 154, y: 470, text: 'Nuovo messaggio da Croce Verde', maxWidth: 520, maxHeight: 30 });
    img.print({ font: fontBlack, x: 154, y: 520, text: 'Hai ricevuto una risposta alla tua candidatura.', maxWidth: 700, maxHeight: 40 });
    img.print({ font: fontBlack, x: 154, y: 730, text: 'Attività aggiornata', maxWidth: 300, maxHeight: 30 });
    img.print({ font: fontBlack, x: 154, y: 780, text: 'Distribuzione pasti spostata alle 18:30.', maxWidth: 620, maxHeight: 40 });
    img.print({ font: fontBlack, x: 154, y: 990, text: 'Promemoria', maxWidth: 220, maxHeight: 30 });
    img.print({ font: fontBlack, x: 154, y: 1040, text: 'Domani inizia il tuo turno alle 09:00.', maxWidth: 600, maxHeight: 40 });
  }

  await img.write(path.join(OUT_DIR, frame.file));
}

async function main() {
  await ensureDir(OUT_DIR);
  const fontWhite = await loadFont(FONT_WHITE);
  const fontBlack = await loadFont(FONT_BLACK);

  for (const frame of FRAMES) {
    await makeImage(frame, fontWhite, fontBlack);
  }

  console.log(`Generated ${FRAMES.length} marketing PNGs in ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
