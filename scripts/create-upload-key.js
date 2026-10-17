/* eslint-env node */
// Creates the Google Play upload keystore and registers it with Gradle.
// Usage: npm run keystore [-- <keystore path>]
//
// The keystore goes OUTSIDE the repo (default ~/keys/helpmecross-upload.keystore)
// and its path + password are written to ~/.gradle/gradle.properties, which
// android/app/build.gradle reads. Nothing secret is written into this project.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ALIAS = 'helpmecross';
const PROP = 'HELPMECROSS_UPLOAD';
const keystore = path.resolve(process.argv[2] || path.join(os.homedir(), 'keys', 'helpmecross-upload.keystore'));
const gradleProps = path.join(process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle'), 'gradle.properties');
const repo = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function keytoolPath() {
  const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool';
  const fromJavaHome = process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', exe);
  return fromJavaHome && fs.existsSync(fromJavaHome) ? fromJavaHome : 'keytool';
}

/** Reads a line without echoing it. */
function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = text => {
      if (text.includes(question)) {
        rl.output.write(text);
      }
    };
    rl.question(question, answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  if (keystore.startsWith(repo + path.sep)) {
    fail(`Keep the keystore outside the project (the repo is public): ${keystore}`);
  }
  if (fs.existsSync(keystore)) {
    fail(`${keystore} already exists. Play needs the same key for every update, so it won't be replaced.`);
  }
  const existing = fs.existsSync(gradleProps) ? fs.readFileSync(gradleProps, 'utf8') : '';
  if (existing.includes(`${PROP}_STORE_FILE`)) {
    fail(`${gradleProps} already points at an upload key. Remove the ${PROP}_* lines first if you really want a new one.`);
  }

  console.log(`Creating the Play upload key at:\n  ${keystore}\n`);
  const password = await askHidden('Choose a keystore password (at least 6 characters): ');
  if (password.length < 6) {
    fail('The password must be at least 6 characters.');
  }
  if ((await askHidden('Repeat the password: ')) !== password) {
    fail('The passwords do not match.');
  }

  fs.mkdirSync(path.dirname(keystore), { recursive: true });
  console.log('\nkeytool will now ask for your name and organisation (used in the certificate):\n');
  const result = spawnSync(
    keytoolPath(),
    [
      '-genkeypair', '-v',
      '-storetype', 'PKCS12',
      '-keystore', keystore,
      '-alias', ALIAS,
      '-keyalg', 'RSA', '-keysize', '2048',
      '-validity', '10000',
      // PKCS12 uses one password for the store and the key; pass it via the
      // environment so it never appears on a command line.
      '-storepass:env', 'HMC_UPLOAD_PASSWORD',
      '-keypass:env', 'HMC_UPLOAD_PASSWORD',
    ],
    { stdio: 'inherit', env: { ...process.env, HMC_UPLOAD_PASSWORD: password } },
  );
  if (result.error) {
    fail(`Could not run keytool (${result.error.message}). Install a JDK or set JAVA_HOME.`);
  }
  if (result.status !== 0 || !fs.existsSync(keystore)) {
    fail('keytool did not create the keystore.');
  }

  // Backslashes are escapes in .properties files: store the path with forward slashes
  // and escape any in the password.
  const propPassword = password.replace(/\\/g, '\\\\');
  const lines = [
    '',
    '# Help Me Cross: Google Play upload key (read by android/app/build.gradle)',
    `${PROP}_STORE_FILE=${keystore.replace(/\\/g, '/')}`,
    `${PROP}_STORE_PASSWORD=${propPassword}`,
    `${PROP}_KEY_ALIAS=${ALIAS}`,
    `${PROP}_KEY_PASSWORD=${propPassword}`,
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(gradleProps), { recursive: true });
  fs.appendFileSync(gradleProps, (existing && !existing.endsWith('\n') ? '\n' : '') + lines);

  console.log(`\n✔ Upload key created: ${keystore}`);
  console.log(`✔ Registered in ${gradleProps}`);
  console.log('\nBack up the keystore file and its password now (password manager, cloud drive).');
  console.log('Every future update must be signed with this key.');
  console.log('\nNext: npm run build:aab');
}

main();
