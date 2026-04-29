import { AppActivity } from '../types';

// Transitional compatibility boundary only.
// Canonical match scoring lives in hooks/smart-match.
export function getLegacyActivityMatchSnapshot(activity?: Pick<AppActivity, 'matchPercentage'> | null): number {
    return typeof activity?.matchPercentage === 'number' ? activity.matchPercentage : 0;
}
