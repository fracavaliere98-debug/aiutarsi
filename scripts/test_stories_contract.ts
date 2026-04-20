import { buildStoryGroups } from "../hooks/stories/selectors";
import { Story } from "../types/stories";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeStory(overrides: Partial<Story>): Story {
  return {
    id: overrides.id || "story-id",
    author_id: overrides.author_id || "author-id",
    caption: overrides.caption || null,
    created_at: overrides.created_at || "2026-04-20T10:00:00.000Z",
    expires_at: overrides.expires_at || "2026-04-21T10:00:00.000Z",
    image_url: overrides.image_url || "https://example.com/story.jpg",
    linked_activity_id: overrides.linked_activity_id || null,
    author: overrides.author || null,
    linked_activity: overrides.linked_activity || null,
  };
}

function run() {
  const stories: Story[] = [
    makeStory({
      id: "npo-unseen-new",
      author_id: "npo-1",
      created_at: "2026-04-20T11:00:00.000Z",
      author: { id: "npo-1", full_name: null, npo_name: "Ente Uno", avatar_url: null, role: "NPO" },
    }),
    makeStory({
      id: "npo-unseen-old",
      author_id: "npo-1",
      created_at: "2026-04-20T09:00:00.000Z",
      author: { id: "npo-1", full_name: null, npo_name: "Ente Uno", avatar_url: null, role: "NPO" },
    }),
    makeStory({
      id: "npo-seen",
      author_id: "npo-2",
      created_at: "2026-04-20T12:00:00.000Z",
      author: { id: "npo-2", full_name: null, npo_name: "Ente Due", avatar_url: null, role: "NPO" },
    }),
    makeStory({
      id: "volunteer-shared",
      author_id: "vol-1",
      created_at: "2026-04-20T08:00:00.000Z",
      author: { id: "vol-1", full_name: "Mario Rossi", npo_name: null, avatar_url: null, role: "VOLUNTEER" },
    }),
    makeStory({
      id: "volunteer-hidden",
      author_id: "vol-2",
      created_at: "2026-04-20T07:00:00.000Z",
      author: { id: "vol-2", full_name: "Luca Bianchi", npo_name: null, avatar_url: null, role: "VOLUNTEER" },
    }),
  ];

  const groups = buildStoryGroups({
    stories,
    viewsState: {
      localViewedStoryIds: [],
      serverViewedStoryIds: ["npo-seen"],
      seenStoryIds: ["npo-seen"],
    },
    allowedAuthorIds: ["npo-1", "npo-2"],
    followedAuthorIds: ["npo-2"],
    affiliatedAuthorIds: ["npo-1"],
    sharedVolunteerAuthorIds: ["vol-1"],
  });

  assert(groups.length === 3, `expected 3 visible groups, got ${groups.length}`);
  assert(groups[0].authorId === "npo-1", "unseen affiliated NPO should be first");
  assert(groups[0].stories[0].id === "npo-unseen-old", "stories inside a group should be oldest first");
  assert(groups[1].authorId === "vol-1", "shared volunteer stories should be visible after NPO groups");
  assert(groups[2].authorId === "npo-2", "fully seen groups should fall after unseen groups");
  assert(groups[2].hasUnseenStories === false, "seen group should be marked as seen");
  assert(groups.every((group) => group.authorId !== "vol-2"), "volunteer stories without shared relation should be hidden");

  console.log("PASS stories domain keeps grouping, ordering, and viewed state canonical");
}

run();
