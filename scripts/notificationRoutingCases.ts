import { AppNotification } from "../hooks/notifications/types";

type RoutingCase = {
  label: string;
  role?: string;
  notification: Pick<
    AppNotification,
    "type" | "title" | "message" | "activityId" | "applicationId" | "npoId" | "conversationId" | "payload"
  >;
  expected: string;
};

export const notificationRoutingCases: RoutingCase[] = [
  {
    label: "NPO followed post redirects to community",
    role: "NPO",
    notification: { type: "FOLLOWED_NPO_POST", title: "Nuovo post", message: "Apri", npoId: "npo-1" },
    expected: "/(npo)/(tabs)/community",
  },
  {
    label: "Volunteer followed story redirects to community",
    role: "VOLUNTEER",
    notification: { type: "FOLLOWED_NPO_STORY", title: "Nuova storia", message: "Apri", npoId: "npo-1" },
    expected: "/(volunteer)/(tabs)/community",
  },
  {
    label: "NPO reengagement INFO redirects to community",
    role: "NPO",
    notification: { type: "INFO", title: "Riattiva la tua community", message: "", payload: { reengagement: true } },
    expected: "/(npo)/(tabs)/community",
  },
  {
    label: "Volunteer reengagement INFO redirects to community",
    role: "VOLUNTEER",
    notification: { type: "INFO", title: "Torna a dare una mano", message: "", payload: { reengagement: true } },
    expected: "/(volunteer)/(tabs)/community",
  },
  {
    label: "Verification SUCCESS redirects to profile",
    role: "NPO",
    notification: { type: "SUCCESS", title: "Profilo Verificato!", message: "" },
    expected: "/(npo)/(tabs)/profile",
  },
  {
    label: "Completed activity redirects to activity detail",
    role: "VOLUNTEER",
    notification: { type: "ACTIVITY_COMPLETED", title: "Missione Compiuta!", message: "", activityId: "activity-123" },
    expected: "/activity/activity-123",
  },
  {
    label: "Completed activity without target falls back to community",
    role: "VOLUNTEER",
    notification: { type: "ACTIVITY_COMPLETED", title: "Missione Compiuta!", message: "" },
    expected: "/(volunteer)/(tabs)/community",
  },
  {
    label: "Chat message without conversation target falls back to inbox",
    role: "VOLUNTEER",
    notification: { type: "CHAT_MESSAGE", title: "Nuovo messaggio", message: "" },
    expected: "/messages",
  },
  {
    label: "Application received routes NPO to candidates",
    role: "NPO",
    notification: { type: "APPLICATION_RECEIVED", title: "Nuova candidatura", message: "" },
    expected: "/(npo)/volunteers?tab=CANDIDATURE",
  },
  {
    label: "Application approved with NPO target routes to profile",
    role: "VOLUNTEER",
    notification: { type: "APPLICATION_APPROVED", title: "Candidatura approvata", message: "", npoId: "npo-1" },
    expected: "/npo-profile/npo-1",
  },
  {
    label: "Application rejected without target falls back to notifications",
    role: "VOLUNTEER",
    notification: { type: "APPLICATION_REJECTED", title: "Candidatura aggiornata", message: "" },
    expected: "/(volunteer)/notifications",
  },
  {
    label: "NPO low coverage without activity target routes to report",
    role: "NPO",
    notification: { type: "NPO_LOW_COVERAGE", title: "Copertura bassa", message: "" },
    expected: "/(npo)/report",
  },
  {
    label: "Weekly NPO recap routes to report",
    role: "NPO",
    notification: { type: "NPO_WEEKLY_RECAP", title: "Report settimanale", message: "" },
    expected: "/(npo)/report",
  },
  {
    label: "Weekly volunteer recap routes to report",
    role: "VOLUNTEER",
    notification: { type: "VOLUNTEER_WEEKLY_RECAP", title: "Report settimanale", message: "" },
    expected: "/(volunteer)/report",
  },
  {
    label: "Gamification reminder with missing role uses volunteer profile fallback",
    notification: { type: "GAMIFICATION_REMIND", title: "Continua così", message: "" },
    expected: "/(volunteer)/(tabs)/profile",
  },
  {
    label: "Valid type with wrong role falls back safely",
    role: "CORPORATE",
    notification: { type: "FOLLOWED_NPO_POST", title: "Nuovo post", message: "", payload: {} },
    expected: "/(volunteer)/(tabs)/community",
  },
];
