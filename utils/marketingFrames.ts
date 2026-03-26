export type MarketingFrameCategory = 'community' | 'onboarding' | 'notifications';
export type MarketingPreviewKind = 'community_gemma' | 'onboarding_intro' | 'notifications_center';

export interface MarketingFrameSpec {
    id: string;
    title: string;
    description: string;
    route: string;
    filename: string;
    category: MarketingFrameCategory;
    splineScene: 'hero-device' | 'stack-devices';
    aspectHint: '9:16' | '4:5' | '1:1';
    preview: MarketingPreviewKind;
    notes: string[];
}

export interface MarketingVideoSpec {
    id: string;
    title: string;
    durationSeconds: number;
    outputName: string;
    scenePreset: 'hero-device' | 'stack-devices';
    frames: string[];
    captions: string[];
}

export const MARKETING_EXPORT_ROOT = 'assets/marketing';
export const MARKETING_SCREENS_DIR = `${MARKETING_EXPORT_ROOT}/screens`;
export const MARKETING_VIDEO_DIR = `${MARKETING_EXPORT_ROOT}/videos`;

export const marketingFrameSpecs: MarketingFrameSpec[] = [
    {
        id: 'community-gemma',
        title: 'Community con Gemma',
        description: 'Frame hero con Gemma in alto, community viva e CTA immediata.',
        route: '/(volunteer)/(tabs)/community',
        filename: 'community_gemma_header_v1.png',
        category: 'community',
        splineScene: 'hero-device',
        aspectHint: '9:16',
        preview: 'community_gemma',
        notes: [
            'Pensata per adv verticali e teaser social.',
            'Mantenere Gemma come focus visivo iniziale.',
            'Ottima per scene con camera move molto lenta.',
        ],
    },
    {
        id: 'onboarding-intro',
        title: 'Onboarding introduttivo',
        description: 'Gemma accoglie il volontario e imposta il tono del prodotto.',
        route: '/onboarding/intro',
        filename: 'onboarding_intro_gemma_v1.png',
        category: 'onboarding',
        splineScene: 'hero-device',
        aspectHint: '9:16',
        preview: 'onboarding_intro',
        notes: [
            'Funziona bene come first impression ad alto impatto.',
            'Usare sfondo pulito e poco testo in Spline.',
            'Candidata ideale per clip brand da 6 secondi.',
        ],
    },
    {
        id: 'notifications-center',
        title: 'Centro notifiche',
        description: 'Schermata notifiche per mostrare attivazione, messaggi e update live.',
        route: '/(volunteer)/notifications',
        filename: 'notifications_center_v1.png',
        category: 'notifications',
        splineScene: 'stack-devices',
        aspectHint: '4:5',
        preview: 'notifications_center',
        notes: [
            'Utile come secondo frame in creatives multi-screen.',
            'Mostra reattività e aggiornamenti in tempo reale.',
            'Buona candidata per stack device o parallasse leggera.',
        ],
    },
];

export const marketingVideoSpecs: MarketingVideoSpec[] = [
    {
        id: 'community-hook',
        title: 'Mini video community',
        durationSeconds: 6,
        outputName: 'community_hook_6s_v1.mp4',
        scenePreset: 'hero-device',
        frames: ['community_gemma_header_v1.png'],
        captions: [
            'Gemma apre la scena',
            'Zoom leggero sul device',
            'Titolo overlay: La community ti porta dentro',
        ],
    },
    {
        id: 'onboarding-brand',
        title: 'Mini video onboarding',
        durationSeconds: 8,
        outputName: 'onboarding_brand_8s_v1.mp4',
        scenePreset: 'hero-device',
        frames: ['onboarding_intro_gemma_v1.png'],
        captions: [
            'Ingresso morbido del device',
            'Focus sul volto di Gemma',
            'CTA finale: Inizia con AiutarSi',
        ],
    },
    {
        id: 'notifications-loop',
        title: 'Mini video notifiche',
        durationSeconds: 5,
        outputName: 'notifications_loop_5s_v1.mp4',
        scenePreset: 'stack-devices',
        frames: ['notifications_center_v1.png'],
        captions: [
            'Device in stack con lieve parallasse',
            'Badge e ping notification come micro-motion',
            'Loop finale per use in app o reels',
        ],
    },
];

export const marketingSplineWorkflow = [
    'Apri il frame marketing dalla schermata dev e verifica il preview.',
    'Esporta il PNG automatico nella cartella marketing.',
    'Importa il PNG in Spline come texture del device.',
    'Usa hero-device per hook singoli e stack-devices per multi-screen.',
    'Esporta MP4 per mini video oppure PNG sequence per motion editing.',
] as const;

export function isDirectlyNavigableMarketingRoute(route: string) {
    return !route.includes('<') && !route.includes('>');
}
