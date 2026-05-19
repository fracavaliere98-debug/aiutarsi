import { MOTION_TIMINGS, STACK_TRANSITIONS } from "../constants/motion";

export const motion = {
  duration: {
    fast: MOTION_TIMINGS.fast,
    base: MOTION_TIMINGS.base,
    slow: MOTION_TIMINGS.slow,
  },
  scale: {
    subtle: 0.99,
    pressed: 0.97,
    strong: 0.95,
  },
  opacity: {
    pressed: 0.9,
    disabled: 0.5,
  },
  stackTransitions: STACK_TRANSITIONS,
} as const;

export { MOTION_TIMINGS, STACK_TRANSITIONS };
