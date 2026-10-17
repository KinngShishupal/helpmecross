/* eslint-env node */
// Builds a signed release and copies it to release/ with the version in its name.
// Usage: npm run build:apk   (installable APK, for testing on a phone)
//        npm run build:aab   (app bundle, for uploading to Google Play)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const kind = process.argv[2];
if (kind !== 'apk' && kind !== 'aab') {
  console.error('Usage: node scripts/build-release.js <apk|aab>');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');
const OUT = path.join(ROOT, 'release');
const PROP = 'HELPMECROSS_UPLOAD_STORE_FILE';

/** Where build.gradle will find the upload keystore, or null if it isn't set up. */
function uploadKeystore() {
  const fromEnv = process.env[`ORG_GRADLE_PROJECT_${PROP}`];
  if (fromEnv) {
    return fromEnv;
  }
  const props = path.join(process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle'), 'gradle.properties');
  if (!fs.existsSync(props)) {
    return null;
  }
  const line = fs
    .readFileSync(props, 'utf8')
    .split(/\r?\n/)
    .find(l => l.trim().startsWith(`${PROP}=`));
  return line ? line.split('=').slice(1).join('=').trim() : null;
}

function version() {
  const gradle = fs.readFileSync(path.join(ANDROID, 'app', 'build.gradle'), 'utf8');
  return {
    name: gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? '0',
    code: gradle.match(/versionCode\s+(\d+)/)?.[1] ?? '0',
  };
}

const keystore = uploadKeystore();
if (keystore && !fs.existsSync(keystore)) {
  console.error(`\n✖ The upload keystore in your Gradle settings is missing: ${keystore}\n`);
  process.exit(1);
}
if (!keystore) {
  if (kind === 'aab') {
    console.error('\n✖ No upload key set up, and Google Play rejects bundles signed with the debug key.');
    console.error('  Run `npm run keystore` first.\n');
    process.exit(1);
  }
  console.warn('\n⚠ No upload key set up: this APK is signed with the debug key.');
  console.warn('  Fine for testing on your own phone, but not for Google Play. Run `npm run keystore` to fix.\n');
}

const task = kind === 'apk' ? 'app:assembleRelease' : 'app:bundleRelease';
// Full path: some Windows setups don't run programs from the current folder.
const win = process.platform === 'win32';
const gradlew = path.join(ANDROID, win ? 'gradlew.bat' : 'gradlew');
console.log(`Building ${kind.toUpperCase()} (${task}). The first release build can take several minutes...\n`);
const result = spawnSync(win ? `"${gradlew}"` : gradlew, [task], { cwd: ANDROID, stdio: 'inherit', shell: win });
if (result.status !== 0) {
  console.error('\n✖ Build failed (see the Gradle output above).\n');
  process.exit(result.status ?? 1);
}

const built =
  kind === 'apk'
    ? path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    : path.join(ANDROID, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
const { name, code } = version();
fs.mkdirSync(OUT, { recursive: true });
const target = path.join(OUT, `HelpMeCross-v${name}-${code}${keystore ? '' : '-debugsigned'}.${kind}`);
fs.copyFileSync(built, target);

const mb = (fs.statSync(target).size / 1024 / 1024).toFixed(1);
console.log(`\n✔ ${path.relative(ROOT, target)} (${mb} MB)`);
console.log(
  kind === 'apk'
    ? '  Install on a connected phone with: adb install -r "' + target + '"'
    : '  Upload this file in Play Console → Testing → Closed testing → Create release.',
);
console.log(`  Remember to raise versionCode (now ${code}) in android/app/build.gradle before the next upload.`);
