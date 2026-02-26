
import { calculateSmartMatch } from "../utils/SmartMatch";
import { Activity, User } from "../types";

// Setup Mock User: "Mario" in Bari (approx 41.11, 16.87)
const mockUser: User = {
    id: "user-1",
    email: "mario@example.com",
    name: "Mario Rossi",
    role: "VOLUNTEER",
    avatar: "",
    impactPoints: 0,
    skills: ["social", "medical"], // Primo Soccorso
    interests: ["Sociale", "Salute"],
    locationCoords: { lat: 41.1127, lng: 16.8722 } // Bari Central
};

// Test Scenarios
const testActivities: Partial<Activity>[] = [
    {
        id: "perfect-match",
        title: "Pasti Solidali Urgentissimi",
        category: "Sociale",
        skills: ["social", "medical"],
        description: "Aiutaci a distribuire pasti. Serve primo soccorso.",
        location: { address: "Piazza Moro, Bari", coords: { lat: 41.1120, lng: 16.8720 } }, // ~100m away
        dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
        isUrgent: true,
    },
    {
        id: "partial-match-far",
        title: "Salvataggio Cani Lontano",
        category: "Animali", // Doesn't match interest
        skills: ["medical"], // Matches 1 skill
        description: "Serve aiuto medico per cani.",
        location: { address: "Milano", coords: { lat: 45.4642, lng: 9.1900 } }, // Very far
        dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days away
        isUrgent: false,
    },
    {
        id: "keyword-match",
        title: "Supporto Tecnico",
        category: "Istruzione",
        skills: ["tech"], // User doesn't have tech
        description: "Aiuto per bambini. Serve anche supporto social e medical.", // Matches keywords in bio
        location: { address: "Bari", coords: { lat: 41.12, lng: 16.88 } }, // ~1km away
        dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days away
        isUrgent: false,
    }
];

function runTest() {
    console.log("=== SMART MATCH AUTOMATED TEST ===\n");

    testActivities.forEach(act => {
        const score = calculateSmartMatch(mockUser, act as Activity);

        console.log(`Activity: ${act.title}`);
        console.log(`- Expected Logic:`);

        if (act.id === "perfect-match") {
            console.log("  * Category OK (+35)");
            console.log("  * Skills 2+ OK (+40)");
            console.log("  * Position <5km OK (+15)");
            console.log("  * Manual Urgent OK (+15)");
            console.log("  * Temporal <=2d OK (+10)");
            console.log(`  * Final Score: ${score}% (Capped at 100)`);
            if (score !== 100) throw new Error("Perfect match should be 100");
        }

        if (act.id === "partial-match-far") {
            // Interests: 0 (Animali vs Sociale/Salute)
            // Skills: 1 match -> 20
            // Position: far -> 0
            // Urgency: false (0) + temporal far (0)
            console.log("  * Category NO (0)");
            console.log("  * Skill 1 OK (+20)");
            console.log("  * Position Far (0)");
            console.log("  * Urgency NO (0)");
            console.log(`  * Final Score: ${score}% (Expected ~20)`);
            if (score !== 20) throw new Error(`Expected score 20, got ${score}`);
        }

        if (act.id === "keyword-match") {
            // Interests: 0 (Istruzione)
            // Skills: No exact, but "social" and "medical" in description -> keyword match -> 20
            // Position: ~1km -> +15
            // Urgency: false (0) + temporal 5d -> +5
            console.log("  * Category NO (0)");
            console.log("  * Keyword Match OK (+20)");
            console.log("  * Position Close (+15)");
            console.log("  * Temporal 5d OK (+5)");
            console.log(`  * Final Score: ${score}% (Expected ~40)`);
            if (score !== 40) throw new Error(`Expected score 40, got ${score}`);
        }

        console.log("----------------------------------\n");
    });

    console.log("✅ ALL MATCH TESTS PASSED!");
}

try {
    runTest();
} catch (e: any) {
    console.error("❌ TEST FAILED:", e.message);
    process.exit(1);
}
