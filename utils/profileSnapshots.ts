import { AppUser } from "../types";

type ProfileImpactSnapshot = Pick<AppUser, "impact_points" | "impactPoints" | "xp"> | null | undefined;

// Transitional profile-side snapshot adapter.
// Domain logic must not treat these aliases as canonical state.
export function getProfileImpactPointsSnapshot(profile: ProfileImpactSnapshot): number {
  if (typeof profile?.impact_points === "number") return profile.impact_points;
  if (typeof profile?.impactPoints === "number") return profile.impactPoints;
  if (typeof profile?.xp === "number") return profile.xp;
  return 0;
}
