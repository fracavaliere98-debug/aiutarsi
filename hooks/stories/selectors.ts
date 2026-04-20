import { Story } from "../../types/stories";
import { StoryAuthorGroup, StoryViewsState } from "./types";

type BuildStoryGroupsParams = {
  stories: Story[];
  viewsState?: StoryViewsState;
  allowedAuthorIds?: string[];
  followedAuthorIds?: string[];
  affiliatedAuthorIds?: string[];
  sharedVolunteerAuthorIds?: string[];
};

function getExpiryLabel(expiresAt?: string | null, isLive = false) {
  if (isLive) return "LIVE";
  if (!expiresAt) return "24h";

  const msLeft = new Date(expiresAt).getTime() - Date.now();
  const hLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)));
  return hLeft < 1 ? "<1h" : `${hLeft}h`;
}

function getAuthorShortName(story: Story) {
  const name = story.author?.npo_name || story.author?.full_name || "Story";
  return name.split(" ")[0] || name;
}

export function buildStoryGroups({
  stories,
  viewsState,
  allowedAuthorIds,
  followedAuthorIds,
  affiliatedAuthorIds,
  sharedVolunteerAuthorIds,
}: BuildStoryGroupsParams): StoryAuthorGroup[] {
  const viewedSet = new Set(viewsState?.seenStoryIds || []);
  const allowedSet = allowedAuthorIds?.length ? new Set(allowedAuthorIds) : null;
  const followedSet = new Set(followedAuthorIds || []);
  const affiliatedSet = new Set(affiliatedAuthorIds || []);
  const sharedVolunteerSet = new Set(sharedVolunteerAuthorIds || []);
  const groups = new Map<string, Story[]>();

  for (const story of stories) {
    if (!story.author_id) continue;
    const isNpoAuthor = story.author?.role === "NPO";
    const isVolunteerAuthor = story.author?.role === "VOLUNTEER";

    if (isNpoAuthor && allowedSet && !allowedSet.has(story.author_id)) continue;
    if (isVolunteerAuthor && !sharedVolunteerSet.has(story.author_id)) continue;
    if (!isNpoAuthor && !isVolunteerAuthor) continue;

    const existing = groups.get(story.author_id) || [];
    existing.push(story);
    groups.set(story.author_id, existing);
  }

  return Array.from(groups.entries())
    .map(([authorId, authorStories]) => {
      const sortedStories = [...authorStories].sort(
        (a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime()
      );
      const firstStory = sortedStories[0];
      const latestStory = sortedStories[sortedStories.length - 1];
      const unseenCount = sortedStories.filter((story) => !viewedSet.has(story.id)).length;
      const isLive = sortedStories.some((story) => story.linked_activity?.status === "IN_CORSO");

      return {
        authorId,
        stories: sortedStories,
        firstStory,
        latestStory,
        hasUnseenStories: unseenCount > 0,
        unseenCount,
        isLive,
        isAffiliatedNpo: affiliatedSet.has(authorId),
        isFollowedNpo: !affiliatedSet.has(authorId) && followedSet.has(authorId),
        authorDisplayName: firstStory.author?.npo_name || firstStory.author?.full_name || "Story",
        authorShortName: getAuthorShortName(firstStory),
        expiryLabel: getExpiryLabel(latestStory.expires_at, isLive),
      } satisfies StoryAuthorGroup;
    })
    .sort((a, b) => {
      if (a.hasUnseenStories !== b.hasUnseenStories) {
        return a.hasUnseenStories ? -1 : 1;
      }

      const priority = (group: StoryAuthorGroup) => {
        if (group.firstStory.author?.role === "VOLUNTEER") return 3;
        if (group.isAffiliatedNpo) return 0;
        if (group.isFollowedNpo) return 1;
        return 2;
      };

      const priorityDiff = priority(a) - priority(b);
      if (priorityDiff !== 0) return priorityDiff;

      return (
        new Date(b.latestStory.created_at as string).getTime() -
        new Date(a.latestStory.created_at as string).getTime()
      );
    });
}
