/**
 * Contract test per hooks/activities/selectorsLogic.ts: statistiche volontario (ore totali,
 * conteggio missioni), rating medio di un ente, filtri per proprietario/recensioni. Logica
 * di business reale (calcolo ore, arrotondamento rating) mai coperta finora perché vive
 * dentro useMemo di hook React.
 *
 * Run: npx tsx scripts/test_activities_selectors_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppActivity, AppUser, OldReview } from "../types";
import {
  computeNPORating,
  computeVolunteerStats,
  filterActivitiesByOwner,
  filterReviewsByVolunteer,
} from "../hooks/activities/selectorsLogic";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function activity(overrides: Partial<AppActivity> = {}): AppActivity {
  return {
    id: "a1",
    npoId: "npo-1",
    npoName: "Ente Test",
    title: "Distribuzione Pasti",
    dateTime: "2024-01-10T10:00:00.000Z",
    endDateTime: "2024-01-10T12:00:00.000Z",
    location: { coords: { lat: 45.46, lng: 9.19 }, address: "Via Roma 1" },
    slots: 5,
    category: "Sociale",
    skills: [],
    description: "desc",
    status: "APERTA",
    iscritti: [],
    isUrgent: false,
    ...overrides,
  } as AppActivity;
}

function volunteer(overrides: Partial<AppUser> = {}): AppUser {
  return { id: "vol-1", role: "VOLUNTEER", ...overrides } as AppUser;
}

function review(overrides: Partial<OldReview> = {}): OldReview {
  return {
    id: "r1",
    activityId: "a1",
    npoId: "npo-1",
    volunteerId: "vol-1",
    stars: 5,
    comment: "",
    feelings: [],
    date: "2024-01-11T00:00:00.000Z",
    ...overrides,
  };
}

// ── computeVolunteerStats ───────────────────────────────────────────────────

function testVolunteerStatsNonVolunteer() {
  console.log("\n[activities] computeVolunteerStats — ruoli non volontario / utente assente");

  const activities = [activity({ status: "COMPLETATA", iscritti: ["vol-1"] })];
  assert(
    JSON.stringify(computeVolunteerStats(activities, undefined)) === JSON.stringify({ totalHours: 0, completedMissions: 0, activeMissions: 0, upcomingMissions: 0 }),
    "utente non ancora caricato (undefined) → tutti zeri, mai un crash"
  );
  assert(
    computeVolunteerStats(activities, volunteer({ role: "NPO" as AppUser["role"] })).totalHours === 0,
    "ruolo NPO → nessuna statistica (solo i VOLUNTEER ne hanno)"
  );
  pass("nessuna statistica calcolata per ruoli diversi da VOLUNTEER o utente assente");
}

function testVolunteerStatsHoursAndCounts() {
  console.log("\n[activities] computeVolunteerStats — calcolo ore e conteggi");

  const user = volunteer();
  const activities: AppActivity[] = [
    activity({ id: "a1", status: "COMPLETATA", iscritti: ["vol-1"], dateTime: "2024-01-10T10:00:00.000Z", endDateTime: "2024-01-10T12:00:00.000Z" }), // 2h
    activity({ id: "a2", status: "COMPLETATA", iscritti: ["vol-1"], dateTime: "2024-01-11T09:00:00.000Z", endDateTime: "2024-01-11T12:30:00.000Z" }), // 3.5h
    activity({ id: "a3", status: "IN_CORSO", iscritti: ["vol-1"] }),
    activity({ id: "a4", status: "APERTA", iscritti: ["vol-1"] }),
    activity({ id: "a5", status: "COMPLETATA", iscritti: ["altro-utente"] }), // non è mio, escluso
    activity({ id: "a6", status: "CANCELLATA", iscritti: ["vol-1"] }), // non conta in nessun bucket
  ];

  const stats = computeVolunteerStats(activities, user);
  assert(stats.completedMissions === 2, "solo le attività COMPLETATA a cui sono iscritto contano come completate");
  assert(stats.activeMissions === 1, "1 attività IN_CORSO");
  assert(stats.upcomingMissions === 1, "1 attività APERTA");
  assert(stats.totalHours === 6, "somma ore (2h + 3.5h = 5.5h) arrotondata all'intero più vicino → 6");
  pass("conteggi per stato e somma ore coerenti, filtrati per iscrizione utente");
}

function testVolunteerStatsInvalidDates() {
  console.log("\n[activities] computeVolunteerStats — date non valide non devono far crashare il calcolo");

  const user = volunteer();
  const activities: AppActivity[] = [
    activity({ id: "a1", status: "COMPLETATA", iscritti: ["vol-1"], dateTime: "not-a-date", endDateTime: "also-not-a-date" }),
    activity({ id: "a2", status: "COMPLETATA", iscritti: ["vol-1"], dateTime: "2024-01-10T10:00:00.000Z", endDateTime: "2024-01-10T11:00:00.000Z" }), // 1h
  ];

  const stats = computeVolunteerStats(activities, user);
  assert(stats.totalHours === 1, "una durata NaN (date non valide) contribuisce 0 ore, non NaN/crash, alla somma");
  assert(stats.completedMissions === 2, "entrambe restano conteggiate come completate anche se la durata di una non è calcolabile");
  pass("isNaN guard: date non valide non propagano NaN nella somma totale");
}

// ── filterReviewsByVolunteer / computeNPORating / filterActivitiesByOwner ──

function testFilterReviewsByVolunteer() {
  console.log("\n[activities] filterReviewsByVolunteer");

  const reviews = [review({ id: "r1", volunteerId: "vol-1" }), review({ id: "r2", volunteerId: "vol-2" })];
  assert(filterReviewsByVolunteer(reviews, "vol-1").length === 1, "filtra solo le recensioni del volontario richiesto");
  assert(filterReviewsByVolunteer(reviews, undefined).length === 0, "userId assente → nessuna recensione (mai tutte per errore)");
  pass("filtro recensioni per volontario coerente");
}

function testComputeNPORating() {
  console.log("\n[activities] computeNPORating");

  assert(computeNPORating([], "npo-1") === 0, "nessuna recensione → 0, non NaN");
  assert(computeNPORating([review({ npoId: "npo-1" })], undefined) === 0, "npoId assente → 0");

  const reviews = [
    review({ id: "r1", npoId: "npo-1", stars: 5 }),
    review({ id: "r2", npoId: "npo-1", stars: 4 }),
    review({ id: "r3", npoId: "npo-2", stars: 1 }), // altro ente, escluso
  ];
  assert(computeNPORating(reviews, "npo-1") === 4.5, "media (5+4)/2 = 4.5, altri enti esclusi");

  const threeReviews = [
    review({ id: "r1", npoId: "npo-3", stars: 5 }),
    review({ id: "r2", npoId: "npo-3", stars: 4 }),
    review({ id: "r3", npoId: "npo-3", stars: 4 }),
  ];
  assert(computeNPORating(threeReviews, "npo-3") === 4.3, "media (5+4+4)/3 = 4.333... arrotondata a 1 decimale → 4.3");
  pass("rating medio arrotondato a 1 decimale, filtrato per ente");
}

function testFilterActivitiesByOwner() {
  console.log("\n[activities] filterActivitiesByOwner");

  const activities = [activity({ id: "a1", npoId: "npo-1" }), activity({ id: "a2", npoId: "npo-2" })];
  assert(filterActivitiesByOwner(activities, "npo-1").length === 1, "filtra solo le attività dell'ente richiesto");
  assert(filterActivitiesByOwner(activities, undefined).length === 0, "userId assente → nessuna attività");
  pass("filtro attività per proprietario coerente");
}

// ── Wiring: gli hook devono delegare alla logica pura testata sopra ─────────

function testStructuralWiring() {
  console.log("\n[wiring] hooks/activities/selectors.ts riusa selectorsLogic.ts");

  const source = readSource("hooks/activities/selectors.ts");

  for (const fn of ["computeVolunteerStats", "filterReviewsByVolunteer", "computeNPORating", "filterActivitiesByOwner"]) {
    assert(source.includes(fn), `selectors.ts deve usare ${fn} da selectorsLogic.ts`);
  }
  pass("useVolunteerStats/useUserReviews/useNPORating/useActivitiesByOwner delegano tutti alla logica pura testata sopra");
}

// ── Runner ────────────────────────────────────────────────────────────────

function run() {
  console.log("Activities selectors logic contract tests");
  console.log("─".repeat(60));

  testVolunteerStatsNonVolunteer();
  testVolunteerStatsHoursAndCounts();
  testVolunteerStatsInvalidDates();
  testFilterReviewsByVolunteer();
  testComputeNPORating();
  testFilterActivitiesByOwner();
  testStructuralWiring();

  console.log("\n" + "─".repeat(60));
  console.log("All activities selectors contract checks passed ✓");
}

run();
