const fs = require('fs');
const files = [
    'app/(corporate)/_layout.tsx',
    'app/(npo)/(tabs)/volunteers.tsx',
    'app/(npo)/edit-profile.tsx',
    'app/(npo)/settings/edit-profile.tsx',
    'app/(volunteer)/(tabs)/_layout.tsx',
    'app/(volunteer)/review-application.tsx',
    'app/(volunteer)/settings.tsx',
    'components/UserAvatar.tsx'
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    // Fix imports
    content = content.replace(/import\s*{([^}]*)OldUser([^}]*)}\s*from\s*['"]lucide-react-native['"]/g, "import {$1User$2} from 'lucide-react-native'");

    // Fix JSX tags
    content = content.replace(/<OldUser/g, '<User');
    content = content.replace(/<\/OldUser>/g, '</User>');

    fs.writeFileSync(f, content, 'utf8');
});
console.log('Fixed lucide-react-native imports');
