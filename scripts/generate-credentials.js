const fs = require('fs');
const path = require('path');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const credentials = {
  android: {
    keystore: {
      keystorePath: requireEnv('EAS_ANDROID_KEYSTORE_PATH'),
      keystorePassword: requireEnv('EAS_ANDROID_KEYSTORE_PASSWORD'),
      keyAlias: requireEnv('EAS_ANDROID_KEY_ALIAS'),
      keyPassword: requireEnv('EAS_ANDROID_KEY_PASSWORD'),
    },
  },
};

const outputPath = path.resolve(process.cwd(), 'credentials.json');
fs.writeFileSync(outputPath, JSON.stringify(credentials, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outputPath}`);
