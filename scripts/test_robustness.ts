import { authService } from '../services/AuthService';
import { activityService } from '../services/ActivityService';
import { eventEmitter, SyncEvents } from '../utils/EventEmitter';

async function testSync() {
    console.log("--- Starting Robustness & Sync Verification ---");

    // Mock Storage
    const mockStorage: Record<string, string> = {};
    const mockAdapter = {
        getItem: async (key: string) => mockStorage[key] || null,
        setItem: async (key: string, value: string) => { mockStorage[key] = value; },
        removeItem: async (key: string) => { delete mockStorage[key]; }
    };
    (authService as any).storage = mockAdapter;
    (activityService as any).storage = mockAdapter;

    let userSyncCount = 0;
    let activitySyncCount = 0;

    eventEmitter.on(SyncEvents.SYNC_USERS, () => {
        userSyncCount++;
        console.log("Event Received: SYNC_USERS");
    });

    eventEmitter.on(SyncEvents.SYNC_ACTIVITIES, () => {
        activitySyncCount++;
        console.log("Event Received: SYNC_ACTIVITIES");
    });

    // 1. Test AuthService Emit
    console.log("Registering a user...");
    await authService.register({
        email: "sync@test.com",
        password: "pass",
        name: "Sync Tester",
        role: "VOLUNTEER"
    } as any);

    // 2. Test ActivityService Emit
    console.log("Creating an activity...");
    await activityService.createActivity({
        npoId: "npo_1",
        npoName: "NPO 1",
        title: "Sync Activity",
        dateTime: new Date().toISOString(),
        endDateTime: new Date().toISOString(),
        location: { address: "Test", coords: { lat: 0, lng: 0 } },
        slots: 10,
        category: "Test",
        description: "Test",
        status: "APERTA",
        iscritti: [],
        matchPercentage: 0,
        skills: [],
        isUrgent: false
    });

    console.log("--- Results ---");
    console.log("SYNC_USERS emitted:", userSyncCount === 1);
    console.log("SYNC_ACTIVITIES emitted:", activitySyncCount === 1);

    if (userSyncCount === 1 && activitySyncCount === 1) {
        console.log("--- Verification Success ---");
    } else {
        console.log("--- Verification Failed ---");
        process.exit(1);
    }
}

testSync().catch(console.error);
