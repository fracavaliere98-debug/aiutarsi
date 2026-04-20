import { buildStoryGroups } from "../hooks/stories/selectors";
import { appendLocalViewedStory, buildStoryViewsState, reconcileLocalViewedBridge } from "../hooks/stories/viewState";
import { Story } from "../types/stories";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeStory(id: string, authorId = "npo-1"): Story {
  return {
    id,
    author_id: authorId,
    caption: null,
    created_at: "2026-04-20T10:00:00.000Z",
    expires_at: "2026-04-21T10:00:00.000Z",
    image_url: "https://example.com/story.jpg",
    linked_activity_id: null,
    author: { id: authorId, full_name: null, npo_name: "Ente", avatar_url: null, role: "NPO" },
    linked_activity: null,
  };
}

function run() {
  const localBridge = { viewedStoryIds: ["story-local", "story-shared"] };
  const serverViewed = ["story-server", "story-shared"];

  const viewsState = buildStoryViewsState(localBridge, serverViewed);
  assert(
    viewsState.seenStoryIds.includes("story-local") &&
      viewsState.seenStoryIds.includes("story-server") &&
      viewsState.seenStoryIds.includes("story-shared"),
    "seen should be localViewed OR serverViewed"
  );

  const reconciled = reconcileLocalViewedBridge(localBridge, serverViewed);
  assert(
    reconciled.viewedStoryIds.length === 1 && reconciled.viewedStoryIds[0] === "story-local",
    "reconciliation should drop locally pending ids once the server confirms them"
  );

  const appendedOnce = appendLocalViewedStory(undefined, "story-a");
  const appendedTwice = appendLocalViewedStory(appendedOnce, "story-a");
  assert(
    appendedTwice.viewedStoryIds.length === 1,
    "local optimistic bridge should stay idempotent for repeated opens of the same story"
  );

  const groups = buildStoryGroups({
    stories: [makeStory("story-local"), makeStory("story-server"), makeStory("story-unseen", "npo-2")],
    viewsState,
    allowedAuthorIds: ["npo-1", "npo-2"],
  });

  const seenGroup = groups.find((group) => group.authorId === "npo-1");
  const unseenGroup = groups.find((group) => group.authorId === "npo-2");
  assert(seenGroup?.hasUnseenStories === false, "merged seen state should mark groups seen after local/server merge");
  assert(unseenGroup?.hasUnseenStories === true, "unseen groups should remain unseen");

  const restartViewsState = buildStoryViewsState({ viewedStoryIds: [] }, ["story-server"]);
  assert(
    restartViewsState.seenStoryIds.includes("story-server"),
    "server-confirmed views should survive app restarts even without the local bridge"
  );

  console.log("PASS story_views contract covers merge, reconciliation, idempotence, and restart semantics");
}

run();
