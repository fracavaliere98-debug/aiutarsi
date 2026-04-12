import { AppActivity } from '../types';

// Legacy/UI-only snapshot adapter.
// Canonical match scoring lives in the smart match domain, not on AppActivity.
export function getLegacyActivityMatchSnapshot(activity?: Pick<AppActivity, 'matchPercentage'> | null): number {
    return typeof activity?.matchPercentage === 'number' ? activity.matchPercentage : 0;
}

// Transitional helper for screens that still need to display a match snapshot on an activity card.
// This is compatibility only, not a permanent exception to the domain boundary.
export function withLegacyActivityMatchSnapshot<T extends AppActivity>(activity: T, score: number): T {
    return {
        ...activity,
        matchPercentage: score,
    };
}
