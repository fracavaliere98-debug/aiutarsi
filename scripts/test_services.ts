import { AuthService } from '../services/AuthService';
import { ActivityService } from '../services/ActivityService';
import { NPOService } from '../services/NPOService';
import { IStorage } from '../services/StorageAdapter';

// 1. Mock Storage Implementation
class MockStorage implements IStorage {
    private store: Map<string, string> = new Map();

    async getItem(key: string): Promise<string | null> {
        return this.store.get(key) || null;
    }

    async setItem(key: string, value: string): Promise<void> {
        this.store.set(key, value);
    }

    async removeItem(key: string): Promise<void> {
        this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }
}

// 2. Test Runner
async function runTests() {
    console.log('🚀 Starting Service Layer Verification...\n');

    const storage = new MockStorage();
    const authService = new AuthService();
    const activityService = new ActivityService();
    const npoService = new NPOService();

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void>) {
        try {
            process.stdout.write(`TEST: ${name}... `);
            await fn();
            console.log('✅ PASS');
            passed++;
        } catch (error) {
            console.log('❌ FAIL');
            console.error(error);
            failed++;
        }
    }

    // --- Auth Tests ---
    await test('AuthService - Register User', async () => {
        const user = await authService.register({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
            role: 'VOLUNTEER',
            avatar: '',
            impactPoints: 0,
            skills: [],
            interests: []
        });

        if (user.email !== 'test@example.com') throw new Error('Email mismatch');
        if (!user.id) throw new Error('ID not generated');
    });

    await test('AuthService - Login User', async () => {
        const user = await authService.login('test@example.com', 'password123');
        if (!user) throw new Error('Login failed');
    });

    await test('AuthService - Login Invalid', async () => {
        try {
            await authService.login('test@example.com', 'wrongpass');
            throw new Error('Should have failed');
        } catch (e: any) {
            if (e.message !== 'Invalid credentials') throw e;
        }
    });

    // --- Activity Tests ---
    let createdActivityId: string;

    await test('ActivityService - Create Activity', async () => {
        const activity = await activityService.createActivity({
            npoId: 'npo_1',
            npoName: 'Test NPO',
            title: 'Test Activity',
            dateTime: new Date().toISOString(),
            endDateTime: new Date().toISOString(),
            location: { coords: { lat: 0, lng: 0 }, address: 'Test Location' },
            slots: 5,
            category: 'Sociale',
            skills: [],
            description: 'Test Description',
            status: 'APERTA',
            iscritti: [],
            matchPercentage: 0,
            isUrgent: false
        });

        createdActivityId = activity.id;
        if (!createdActivityId) throw new Error('Activity ID missing');
    });

    await test('ActivityService - Get Activities', async () => {
        const { activities } = await activityService.getActivities();
        const found = activities.find((a: any) => a.id === createdActivityId);
        if (!found) throw new Error('Created activity not found in list');
    });

    await test('ActivityService - Join Activity', async () => {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) throw new Error('No current session');

        const updated = await activityService.joinActivity(createdActivityId, currentUser.id);
        if (!updated.iscritti.includes(currentUser.id)) throw new Error('User not in participants list');
    });


    // --- NPO Tests ---
    await test('NPOService - Follow NPO', async () => {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) throw new Error('No current session');

        // We use a dummy NPO ID since we mock the storage and just check logic
        await npoService.followNPO('npo_dummy_id', currentUser.id);
        const updatedUser = await authService.getCurrentUser();
        if (!updatedUser?.followedNPOs?.includes('npo_dummy_id')) throw new Error('NPO not followed');
    });

    // 5. Verify Logout
    await test('AuthService - Logout', async () => {
        console.log('\n   [Logout Test]');
        await authService.logout();
        const currentUser = await authService.getCurrentUser();

        if (currentUser === null) {
            console.log('   ✅ Logout successful: Session cleared.');
            console.log('   ℹ️  UI BEHAVIOR VERIFICATION:');
            console.log('      When "user" becomes null, the root Stack will unmount protected routes.');
            console.log('      This MUST automatically redirect the user to the Landing Page ("/").');
        } else {
            throw new Error('Logout failed: User still logged in');
        }
    });

    console.log(`\n\n🎉 Verification Complete: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests();
