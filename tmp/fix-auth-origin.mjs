import { loadEnvFile } from 'node:process';
import { neon } from '@neondatabase/serverless';
loadEnvFile('.env');
const sql = neon(process.env.DATABASE_URL);
const origin = new URL(process.env.PUBLIC_SITE_URL).origin;
if (origin !== 'https://darryls-lab.vercel.app') throw new Error('Unexpected production origin');
const rows = await sql`update neon_auth.project_config
  set trusted_origins = coalesce(trusted_origins, '[]'::jsonb) || jsonb_build_array(${origin}::text), updated_at = now()
  where id = '7a04d428-c8cb-4ffa-a003-faebd7e2b31d'::uuid
  and endpoint_id = 'ep-proud-snow-zaqpy44j'
  and not coalesce(trusted_origins, '[]'::jsonb) @> jsonb_build_array(${origin}::text)
  returning trusted_origins`;
console.log({updated: rows.length, trustedOrigins: rows[0]?.trusted_origins});
