import { readFile } from 'node:fs/promises';
import pg from 'pg';
process.loadEnvFile('.env');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query('begin');
  await client.query(await readFile('database/enquiries.sql', 'utf8'));
  const result = await client.query(
    `update neon_auth.project_config set email_and_password = jsonb_set(email_and_password, '{disableSignUp}', 'true'::jsonb) returning id`,
  );
  if (result.rowCount !== 1) throw new Error('Expected exactly one auth configuration');
  await client.query('commit');
  console.log('Enquiry storage installed; public signup disabled.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error('Enquiry setup failed:', error.code || error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
