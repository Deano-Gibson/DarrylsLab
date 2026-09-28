import {loadEnvFile} from 'node:process';
import {randomBytes} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {customer} from '../server/platform.js';
import {decodeJwt,createRemoteJWKSet,jwtVerify} from 'jose';
loadEnvFile('.env');
const sql=neon(process.env.DATABASE_URL);
const email=`dl-check-${randomBytes(8).toString('hex')}@example.invalid`;
const password=randomBytes(24).toString('base64url');
const base=process.env.NEON_AUTH_URL.replace(/\/$/,'');
let cookie='', userId;
async function call(path, body) {
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:process.env.PUBLIC_SITE_URL,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const cookies=response.headers.getSetCookie();
 if(cookies.length) cookie=cookies.map(c=>c.split(';')[0]).join('; ');
 const data=await response.json();
 if(data?.user?.id) userId=data.user.id;
 console.log({path,status:response.status,code:data?.code,hasUser:!!data?.user,hasSession:!!data?.session});
 return data;
}
try {
 await call('/sign-up/email',{email,password,name:'Temporary DL verification'});
 const session=await call('/get-session');
 const jwt=await call('/token');
 const token=jwt.token || session?.session?.token;
 if(token){
  try {const claims=decodeJwt(token); console.log({issuer:claims.iss,expectedIssuer:process.env.NEON_AUTH_URL,audience:claims.aud,subjectMatches:claims.sub===userId}); await jwtVerify(token,createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL)),{issuer:process.env.NEON_AUTH_URL}); console.log('JWT validation passed');} catch(error){console.log({jwtError:error.code||error.name,message:error.message});}
  const request=new Request(process.env.PUBLIC_SITE_URL+'/api/account',{headers:{Authorization:`Bearer ${token}`}});
  console.log({localCustomerAccepted:!!await customer(request)});
  for(const path of ['/api/account','/api/availability']){
   const response=await fetch(process.env.PUBLIC_SITE_URL+path,{headers:{Authorization:`Bearer ${token}`}});
   const data=await response.json();
   console.log({path,status:response.status,emailMatches:data.email===email,bookings:data.bookings?.length,slots:data.slots?.length,error:data.error});
  }
 }
 await call('/sign-out',{});
 await call('/sign-in/email',{email,password});
 await call('/sign-out',{});
}finally{
 if(userId){
  const deleted=await sql`delete from neon_auth."user" where id=${userId}::uuid and email=${email} returning id`;
  console.log({temporaryUserRemoved:deleted.length===1});
 }
}
