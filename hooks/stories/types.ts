import { Story } from "../../types/stories";

export type StoryViewerState = {
  viewedStoryIds: string[];
};

export type StoryAuthorGroup = {
  authorId: string;
  stories: Story[];
  firstStory: Story;
  latestStory: Story;
  hasUnseenStories: boolean;
  unseenCount: number;
  isLive: boolean;
  isAffiliatedNpo: boolean;
  isFollowedNpo: boolean;
  authorDisplayName: string;
  authorShortName: string;
  expiryLabel: string;
};

export type StoryViewerSession = {
  groups: StoryAuthorGroup[];
  groupIndex: number;
  storyIndex: number;
};
