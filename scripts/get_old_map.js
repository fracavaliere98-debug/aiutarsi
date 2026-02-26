const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const filePath = 'app/(volunteer)/(tabs)/map.tsx';
console.log(`Checking history for: ${filePath}`);

try {
    const logOutput = execSync(`git log -n 10 --oneline "${filePath}"`, { encoding: 'utf8' });
    console.log("Recent commits:");
    console.log(logOutput);

    // Get the commit hashes
    const lines = logOutput.trim().split('\n');
    if (lines.length > 2) {
        // Let's grab the 3rd or 4th commit back, before recent experiments
        const targetCommit = lines[3].split(' ')[0];
        console.log(`\nFetching version from commit: ${targetCommit} (${lines[3]})`);

        const fileContent = execSync(`git show ${targetCommit}:"${filePath}"`, { encoding: 'utf8' });
        fs.writeFileSync(path.join(__dirname, 'map_old.tsx'), fileContent);
        console.log("Saved old version to scripts/map_old.tsx for comparison.");
    }
} catch (error) {
    console.error("Error executing git command:", error.message);
}
