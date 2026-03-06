const fs = require('fs');
const path = require('path');

const DIRS = ['app', 'components', 'context', 'hooks', 'services', 'utils'];
const TARGETS = [
    'User', 'Activity', 'Review', 'VolunteerReview',
    'ActivityApplication', 'Application', 'Candidature',
    'Employee', 'SmartMatchResult'
];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = DIRS.flatMap(dir => walk(path.join(__dirname, '..', dir)));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // We only want to replace TARGETS when they are imported from types
    // or when they are used as types. A simple regex for word boundaries:
    // But to be safe, we replace ONLY `Type` with `OldType` if it has an uppercase first letter
    // and isn't a string literal.

    // First, update imports from types:
    // import { User, Activity } from '../types' -> import { OldUser as User, OldActivity as Activity }
    TARGETS.forEach(target => {
        const regexStr = `\\b${target}\\b`;
        const regex = new RegExp(regexStr, 'g');
        if (regex.test(content)) {
            // Because TS variables usually are lowercase `const user: User`, 
            // replacing `User` -> `OldUser` everywhere (except `import` paths) 
            // is mostly safe because variables are lowercase `user`, `activity`.
            // Let's do a global replace carefully.

            // Actually, if we just change the import:
            // `import { ..., Activity, ... } from '.../types'`
            // It's safer to just replace `Activity` with `OldActivity` EVERYWHERE in the file 
            // because if they used the type, they used `Activity`. If they named a component `ActivityCard`, it won't match `\bActivity\b`.

            content = content.replace(regex, `Old${target}`);
            changed = true;
        }
    });

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
