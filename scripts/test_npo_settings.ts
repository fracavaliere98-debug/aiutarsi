import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..');

function checkFile(filePath: string, description: string) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`UNKNOWN ERROR: ${description} file not found: ${filePath}`);
        return false;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Check for default export
    if (!content.includes('export default function')) {
        console.error(`ERROR: ${description} missing default export function`);
        console.log(`Preview: ${content.substring(0, 200)}...`);
        return false;
    }

    // Check for critical imports
    if (content.includes("from '../../")) {
        console.error(`ERROR: ${description} contains incorrect relative import ('../../')`);
        return false;
    }

    console.log(`SUCCESS: ${description} validates.`);
    return true;
}

function runTest() {
    console.log("Running NPO Settings Verification...");

    let allPassed = true;
    allPassed = checkFile('app/(npo)/settings/edit-profile.tsx', 'Edit Profile Screen') && allPassed;
    allPassed = checkFile('app/(npo)/settings/security.tsx', 'Security Screen') && allPassed;

    // Check layout registration
    const layoutPath = path.join(projectRoot, 'app/(npo)/_layout.tsx');
    if (fs.existsSync(layoutPath)) {
        const layoutContent = fs.readFileSync(layoutPath, 'utf8');
        if (!layoutContent.includes('name="settings/edit-profile"')) {
            console.error("ERROR: Edit Profile screen not registered in (npo)/_layout.tsx");
            allPassed = false;
        }
        if (!layoutContent.includes('name="settings/security"')) {
            console.error("ERROR: Security screen not registered in (npo)/_layout.tsx");
            allPassed = false;
        }
    } else {
        console.error("ERROR: (npo)/_layout.tsx not found");
        allPassed = false;
    }

    if (allPassed) {
        console.log("\nALL CHECKS PASSED: NPO Settings configuration appears correct.");
    } else {
        console.error("\nTEST FAILED: Issues found in NPO Settings configuration.");
        process.exit(1);
    }
}

runTest();
