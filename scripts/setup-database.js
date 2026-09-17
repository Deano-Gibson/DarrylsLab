import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Also accepts the quoted `psql 'postgresql://…'` snippet pasted into the ignored .env file.
async function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = (await readFile('.env', 'utf8')).trim();
  const assignment = raw.match(/^DATABASE_URL=(.+)$/m);
  if (assignment) return assignment[1].trim();
  const match = raw.match(/^psql\s+['"](postgres(?:ql)?:\/\/[^'"\s]+)['"]$/);
  if (!match) throw new Error('Set DATABASE_URL or put the Neon psql command in .env');
  return match[1];
}

const client = new pg.Client({
  connectionString: await connectionString(),
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query('begin');
  await client.query(await readFile('database/schema.sql', 'utf8'));
  await client.query('commit');
  const result = await client.query(
    `select to_regclass('public.session_accounts') is not null as ready`,
  );
  if (!result.rows[0].ready) throw new Error('Schema verification failed');
  console.log('Neon training schema installed and verified.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error('Schema setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
