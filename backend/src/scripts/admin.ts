// Administrator account management from the command line:
//   pnpm --filter @xcel/backend admin:create
//   pnpm --filter @xcel/backend admin:reset-password
// For non-interactive use, set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD.
import { PASSWORD_MIN_LENGTH } from '@xcel/shared';
import { createInterface } from 'node:readline/promises';
import { getDatabase } from '../db/client';
import { AdminUserError, createAdminUser, resetAdminPassword } from '../modules/admin/users';

async function ask(question: string, envName: string): Promise<string> {
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line from the terminal without echoing it. */
async function askHidden(question: string, envName: string): Promise<string> {
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) throw new Error(`Set ${envName} when not running in a terminal`);

  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          return resolve(value);
        }
        if (char === '\u0003') {
          cleanup();
          return reject(new Error('Cancelled'));
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on('data', onData);
  });
}

async function askNewPassword(): Promise<string> {
  const password = await askHidden(
    `Password (at least ${PASSWORD_MIN_LENGTH} characters): `,
    'ADMIN_PASSWORD',
  );
  if (!process.env.ADMIN_PASSWORD && password !== (await askHidden('Repeat password: ', '_'))) {
    throw new AdminUserError('Passwords do not match');
  }
  return password;
}

const command = process.argv[2];
const database = getDatabase();
try {
  if (command === 'create') {
    const email = await ask('Email: ', 'ADMIN_EMAIL');
    const name = await ask('Name: ', 'ADMIN_NAME');
    const password = await askNewPassword();
    const user = await createAdminUser(database.db, { email, name, password });
    console.log(`Created administrator ${user.email}.`);
  } else if (command === 'reset-password') {
    const email = await ask('Email: ', 'ADMIN_EMAIL');
    const password = await askNewPassword();
    await resetAdminPassword(database.db, email, password);
    console.log(`Password reset for ${email}. All of their sessions have been signed out.`);
  } else {
    console.error('Usage: admin.ts create | reset-password');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof AdminUserError ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.sql.end();
}
