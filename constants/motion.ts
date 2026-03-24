export const MOTION_TIMINGS = {
    fast: 180,
    base: 260,
    slow: 360,
} as const;

export const STACK_TRANSITIONS = {
    root: {
        headerShown: false,
        animation: "fade",
        animationDuration: MOTION_TIMINGS.base,
    },
    push: {
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: MOTION_TIMINGS.base,
    },
    modal: {
        headerShown: false,
        presentation: "card",
        animation: "slide_from_right",
        animationDuration: MOTION_TIMINGS.base,
    },
    sheet: {
        headerShown: false,
        presentation: "modal",
        animation: "slide_from_bottom",
        animationDuration: MOTION_TIMINGS.slow,
    },
    fadeModal: {
        headerShown: false,
        presentation: "transparentModal",
        animation: "fade",
        animationDuration: MOTION_TIMINGS.fast,
    },
} as const;
