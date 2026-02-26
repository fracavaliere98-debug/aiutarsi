import { authService } from '../services/AuthService';
import { activityService } from '../services/ActivityService';
const INITIAL_USERS: any[] = []; // Mock data removed from context, so we define empty fallback here

// Mock Storage for Node.js environment
const mockStorage: Record<string, string> = {};
const mockAdapter = {
    getItem: async (key: string) => mockStorage[key] || null,
    setItem: async (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: async (key: string) => { delete mockStorage[key]; }
};

// Inject mock adapter into services
(authService as any).storage = mockAdapter;
(activityService as any).storage = mockAdapter;

async function verifyIdMigration() {
    console.log("--- Starting ID Migration Verification ---");

    // 1. Reset Storage to use new INITIAL_USERS
    console.log("Resetting storage...");
    await mockAdapter.setItem('ALL_USERS', JSON.stringify(INITIAL_USERS));
    await mockAdapter.removeItem('AUTH_STATE');
    await mockAdapter.removeItem('ACTIVITIES_DATA');

    // 2. Verify Initial Users
    const users = await authService.getAllUsers();
    console.log("Initial Users IDs:", users.map(u => u.id));
    const allPrefixed = users.every(u =>
        u.id.startsWith('vol_') || u.id.startsWith('npo_') || u.id.startsWith('corp_')
    );
    console.log("Initial IDs follow prefixes:", allPrefixed);

    // 3. Test Registration
    console.log("Testing Registration...");
    const newUser = await authService.register({
        email: "new_vol@test.com",
        password: "password",
        name: "New Volunteer",
        role: "VOLUNTEER"
    } as any);
    console.log("New User ID:", newUser.id);
    console.log("New ID starts with vol_:", newUser.id.startsWith('vol_'));

    // 4. Test Activity Creation
    const newAct = await activityService.createActivity({
        npoId: "npo_prova",
        npoName: "NPOPROVA",
        title: "Test Activity",
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
    console.log("New Activity ID:", newAct.id);
    console.log("New ID starts with act_:", newAct.id.startsWith('act_'));

    console.log("--- Verification Completed ---");
}

verifyIdMigration().catch(console.error);
