import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..');

function checkFileExists(filePath: string, description: string) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`ERROR: ${description} NOT found at: ${filePath}`);
        return false;
    }
    console.log(`SUCCESS: ${description} found at: ${filePath}`);
    return true;
}

function checkFileNotExists(filePath: string, description: string) {
    const fullPath = path.join(projectRoot, filePath);
    if (fs.existsSync(fullPath)) {
        console.error(`ERROR: ${description} SHOULD NOT exist at: ${filePath}`);
        return false;
    }
    console.log(`SUCCESS: ${description} correctly removed from: ${filePath}`);
    return true;
}

function runTest() {
    console.log("Running NPO Settings Verification (Deep Dive)...");

    let allPassed = true;

    // 1. Verify new files exist
    allPassed = checkFileExists('app/(npo)/edit-profile.tsx', 'New Edit Profile') && allPassed;
    allPassed = checkFileExists('app/(npo)/security.tsx', 'New Security') && allPassed;

    // 2. Verify old folder is gone (optional, but good practice)
    // It seems I tried to remove it, let's check
    const settingsDir = path.join(projectRoot, 'app/(npo)/settings');
    if (fs.existsSync(settingsDir)) {
        console.warn("WARNING: 'app/(npo)/settings' directory still exists. This might cause router confusion if not empty.");
        const files = fs.readdirSync(settingsDir);
        if (files.length > 0) {
            console.error(`ERROR: Old settings directory is not empty! Contains: ${files.join(', ')}`);
            allPassed = false;
        } else {
            console.log("INFO: Old settings directory exists but is empty.");
        }
    }

    // 3. Verify Layout content
    const layoutPath = path.join(projectRoot, 'app/(npo)/_layout.tsx');
    if (fs.existsSync(layoutPath)) {
        const content = fs.readFileSync(layoutPath, 'utf8');
        // Check for correct names for the screens
        if (!content.includes('name="edit-profile"')) {
            console.error('ERROR: _layout.tsx missing Stack.Screen for "edit-profile"');
            allPassed = false;
        }
        if (!content.includes('name="security"')) {
            console.error('ERROR: _layout.tsx missing Stack.Screen for "security"');
            allPassed = false;
        }
        // Check for INCORRECT names
        if (content.includes('name="settings/edit-profile"')) {
            console.error('ERROR: _layout.tsx still references "settings/edit-profile"');
            allPassed = false;
        }
    } else {
        console.error("CRITICAL: (npo)/_layout.tsx missing!");
        allPassed = false;
    }

    if (allPassed) {
        console.log("\nALL CHECKS PASSED. File structure matches expectation.");
    } else {
        console.error("\nTEST FAILED. Please review errors above.");
        process.exit(1);
    }
}

runTest();
