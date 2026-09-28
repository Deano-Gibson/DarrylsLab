import {loadEnvFile} from 'node:process';
import {neon} from '@neondatabase/serverless';
import {createAuthClient} from '@neondatabase/auth';
loadEnvFile('.env');
const email='dl-browser-check-20260925-c91d7f@example.invalid';
if(process.argv[2]==='create'){
 const response=await fetch(process.env.NEON_AUTH_URL+'/sign-up/email',{method:'POST',headers:{Origin:process.env.PUBLIC_SITE_URL,'Content-Type':'application/json'},body:JSON.stringify({email,password:'DL-check-25Sep2026-Z8r!p2k#6Ws',name:'Temporary browser check'})});
 const body=await response.json();
 console.log({created:response.ok,code:body.code});
 if(!response.ok) process.exitCode=1;
}else if(process.argv[2]==='duplicate'){
 try {
  const auth=createAuthClient(process.env.NEON_AUTH_URL,{fetchOptions:{headers:{Origin:process.env.PUBLIC_SITE_URL}}});
  const result=await auth.signUp.email({email,password:'DL-check-25Sep2026-Z8r!p2k#6Ws',name:'Temporary browser check',callbackURL:process.env.PUBLIC_SITE_URL+'/account.html'});
  console.log({error:result.error});
 }catch(error){ console.log({code:error.code,status:error.status,message:error.message,keys:Object.keys(error)}); }
}else if(process.argv[2]==='remove'){
 const rows=await neon(process.env.DATABASE_URL)`delete from neon_auth."user" where email=${email} and name='Temporary browser check' returning id`;
 console.log({temporaryAccountRemoved:rows.length===1});
}
