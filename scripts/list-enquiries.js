import pg from 'pg';
process.loadEnvFile('.env');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  const result = await client.query(
    `select id,name,email,phone,goals,availability,message,intake,consent_version,status,created_at from public.coaching_enquiries order by created_at desc limit 100`,
  );
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
