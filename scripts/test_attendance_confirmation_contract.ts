import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

const sql = read("supabase", "migrations", "20260921150000_attendance_confirmation.sql");

// RLS: il volontario non può auto-assegnarsi APPROVED/CHECKED_IN.
assert(/status::text\s*=\s*'REGISTERED'\)/.test(sql), "Volunteers must only be able to insert REGISTERED participation");
assert(/status::text in \('REGISTERED',\s*'CANCELLED'\)/.test(sql), "Volunteers may only toggle REGISTERED/CANCELLED");

// Il vecchio premio "200 XP su APPROVED" deve essere rimosso.
assert(/drop trigger if exists trg_participation_status_gamification/.test(sql), "Legacy APPROVED XP trigger must be dropped");

// Guardia di integrità sulla presenza.
for (const code of ["NOT_ACTIVITY_OWNER", "ACTIVITY_NOT_COMPLETED", "NOT_A_PARTICIPANT", "ATTENDANCE_LOCKED", "IMMUTABLE_KEYS"]) {
  assert(sql.includes(`raise exception '${code}'`), `Guard must raise ${code}`);
}
assert(/trg_volunteer_attendance_confirmed/.test(sql), "Attendance confirmation must award XP via trigger");
assert(/award_activity_completion_to_user/.test(sql), "Attendance confirmation must reuse the idempotent completion award");

// Client: messaggi d'errore mappati e reminder recensione legato alla presenza.
const screen = read("app", "(npo)", "review-volunteers", "[id].tsx");
for (const code of ["ACTIVITY_NOT_COMPLETED", "NOT_A_PARTICIPANT", "ATTENDANCE_LOCKED"]) {
  assert(screen.includes(code), `Review screen must map ${code} to a friendly message`);
}
const jobs = read("supabase", "functions", "_shared", "notificationJobs.ts");
assert(/volunteer_reviews/.test(jobs) && /is_present/.test(jobs), "Review reminders must require confirmed presence");
const insights = read("hooks", "useNPOInsights.ts");
assert(/'ATTENDANCE'/.test(insights), "NPO insights must surface attendance to confirm");
assert(!/"PENDING"\s*;\s*message/.test(read("utils", "profileRest.ts")), "joinActivity must not allow PENDING");

console.log("attendance confirmation contract OK");
