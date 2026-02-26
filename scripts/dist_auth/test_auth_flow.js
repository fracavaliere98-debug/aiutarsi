"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const SUPABASE_URL = 'https://pavnfiladmnwbptwlwpr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
async function runAuthTest() {
    var _a;
    console.log("🚀 Starting Auth Flow Test...");
    let passed = 0;
    let failed = 0;
    const timestamp = Date.now();
    const testEmail = `auto_test_${timestamp}@example.com`;
    const testPassword = 'password123';
    let userId;
    // 1. Sign Up
    try {
        process.stdout.write(`TEST: Sign Up (${testEmail})... `);
        const { data, error } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
            options: {
                data: {
                    name: 'Auto Test User',
                    role: 'VOLUNTEER'
                }
            }
        });
        if (error)
            throw error;
        if (!data.user)
            throw new Error("No user returned");
        userId = data.user.id;
        console.log('✅ PASS');
        passed++;
    }
    catch (e) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
        process.exit(1); // Cannot proceed without user
    }
    // 2. Verify Profile Creation (Trigger)
    try {
        process.stdout.write(`TEST: Verify Profile Trigger... `);
        // Wait a bit for trigger
        await new Promise(r => setTimeout(r, 1000));
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error)
            throw error;
        if (data.email !== testEmail)
            throw new Error("Email mismatch in profile");
        if (data.role !== 'VOLUNTEER')
            throw new Error("Role mismatch in profile");
        console.log('✅ PASS');
        passed++;
    }
    catch (e) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
    }
    // 3. Update Profile
    try {
        process.stdout.write(`TEST: Update Profile... `);
        const { error } = await supabase
            .from('profiles')
            .update({ bio: 'Updated by automated test' })
            .eq('id', userId);
        if (error)
            throw error;
        // Verify update
        const { data } = await supabase.from('profiles').select('bio').eq('id', userId).single();
        if ((data === null || data === void 0 ? void 0 : data.bio) !== 'Updated by automated test')
            throw new Error("Update failed");
        console.log('✅ PASS');
        passed++;
    }
    catch (e) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
    }
    // 4. Sign Out
    try {
        process.stdout.write(`TEST: Sign Out... `);
        const { error } = await supabase.auth.signOut();
        if (error)
            throw error;
        console.log('✅ PASS');
        passed++;
    }
    catch (e) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
    }
    // 5. Sign In
    try {
        process.stdout.write(`TEST: Sign In... `);
        const { data, error } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });
        if (error)
            throw error;
        if (((_a = data.user) === null || _a === void 0 ? void 0 : _a.id) !== userId)
            throw new Error("User ID mismatch on login");
        console.log('✅ PASS');
        passed++;
    }
    catch (e) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
    }
    // Cleanup (Optional - Supabase Auth doesn't allow easy delete from anon key usually)
    // We'll verify if we can delete the profile to keep things clean, but auth user might remain.
    // Ideally we run this against a local instance or dev project.
    console.log(`\n\n🎉 Auth Test Complete: ${passed} Passed, ${failed} Failed`);
    if (failed > 0)
        process.exit(1);
}
runAuthTest();
