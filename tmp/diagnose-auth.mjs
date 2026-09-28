import { loadEnvFile } from 'node:process';
import { neon } from '@neondatabase/serverless';
loadEnvFile('.env');
const base = process.env.NEON_AUTH_URL.replace(/\/$/, '');
const origin = process.env.PUBLIC_SITE_URL;
console.log({authHost: new URL(base).hostname, authPath: new URL(base).pathname, publicOrigin: origin, frontendMatches: process.env.VITE_NEON_AUTH_URL === process.env.NEON_AUTH_URL});
for (const [path, options] of [
  ['/get-session', {}],
  ['/sign-up/email', {method: 'POST', body: JSON.stringify({email: 'signup-check@example.invalid', password: 'x', name: 'Signup validation check'})}],
]) {
 const response = await fetch(base + path, {...options, headers: {Origin: origin, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(20000)});
 const data = await response.json();
 console.log({path, status: response.status, cors: response.headers.get('access-control-allow-origin'), code: data?.code, message: data?.message, sessionPresent: !!data?.session});
}
const sql = neon(process.env.DATABASE_URL);
console.log(await sql`select id, name, endpoint_id, trusted_origins, email_and_password, allow_localhost, email_provider->>'type' as email_provider_type from neon_auth.project_config`);
console.log({neonManagementKeyPresent: !!process.env.NEON_API_KEY});
console.log(await sql`select column_name, data_type, udt_name from information_schema.columns where table_schema='neon_auth' and table_name='project_config' and column_name in ('trusted_origins', 'updated_at')`);
