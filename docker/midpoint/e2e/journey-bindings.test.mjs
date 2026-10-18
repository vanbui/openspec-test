import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAdmin, createLocalMailbox, createDefaultProbe, readKeycloakVersion, createRealmSmtpAdmin, createNativeRest, readNativeRetry, readNativeAudit, createConflictBinding, PROBE_OPERATOR } from './journey-bindings.mjs';
import { Script } from 'node:vm';
const env = { KEYCLOAK_BASE_URL:'http://localhost:8080',KEYCLOAK_REALM:'idambox',KEYCLOAK_ADMIN_CLIENT_ID:'test-client',KEYCLOAK_ADMIN_CLIENT_SECRET:'private-value' };
const oid = suffix => `11000000-0000-4000-8000-000000000${suffix}`;
test('administrative credential exchange is private, cached and bounded',async()=>{
 let calls=[]; let now=0;
 const admin=createLocalAdmin({env,now:()=>now,transport:async(url,init)=>{calls.push({url,init});return {status:200,json:async()=>({access_token:'private-token',expires_in:60})};}});
 assert.equal(await admin.token(),'private-token'); await admin.token(); assert.equal(calls.length,1);
 assert.equal(calls[0].init.body.get('grant_type'),'client_credentials');
 assert.ok(!calls[0].url.includes(env.KEYCLOAK_ADMIN_CLIENT_SECRET)); now=31000; await admin.token(); assert.equal(calls.length,2);
 assert.throws(()=>createLocalAdmin({env:{...env,KEYCLOAK_BASE_URL:'https://foreign.test'}}));
 const failed=createLocalAdmin({env,transport:async()=>{throw Error('private-value');}});
 await assert.rejects(failed.token(),error=>error.code==='JOURNEY_BINDING_AUTH'&&!error.message.includes('private-value'));
});
test('Mailpit count and receipt keep action links in private storage',async()=>{
 const email='journey-contract-abcdef123456-0@hr.idambox.test';
 const row={ID:'mail-1',Created:'2026-10-17T00:00:01Z',To:[{Address:email}]};
 const action='http://localhost:8080/realms/idambox/login-actions/action-token?key=private';
 let sent=false; const mail=createLocalMailbox({now:()=>Date.parse(row.Created),transport:async url=>({status:200,json:async()=>url.includes('/messages?')?{total:sent?1:0,messages:sent?[row]:[]}:{...row,Text:action}})});
 assert.equal(await mail.count(email),0); sent=true; const receipt=await mail.wait(email,0);
 assert.deepEqual(receipt,{received:true,fresh:true}); assert.equal(mail.action(receipt),action); assert.ok(!JSON.stringify(receipt).includes('private'));
 await assert.rejects(mail.count('foreign@test.invalid'));
});
test('Mailpit truncated or ambiguous delivery fails closed',async()=>{
 const mail=createLocalMailbox({transport:async()=>({status:200,json:async()=>({total:101,messages:[]})})});
 await assert.rejects(mail.count('journey-contract-abcdef123456-0@hr.idambox.test'));
});
test('default probe derives lifespan from the delivered action token rather than a guessed constant',async()=>{
 const email='journey-contract-abcdef123456-0@hr.idambox.test'; let sent=false;
 const claims=Buffer.from(JSON.stringify({sub:'fixture-id',iat:100,exp:43300})).toString('base64url');
 const binding=createDefaultProbe({env,now:()=>Date.parse('2026-10-17T00:00:01Z'),operator:{},browser:{},transport:async(url,init)=>{
  if(url.endsWith('/token'))return {status:200,json:async()=>({access_token:'private',expires_in:60})};
  if(url.endsWith('/users')&&init.method==='POST')return {status:201,headers:new Headers({location:'http://localhost:8080/admin/realms/idambox/users/fixture-id'})};
  if(url.endsWith('/execute-actions-email')){sent=true;return {status:204};}
  if(url.includes('/messages?'))return {status:200,json:async()=>({total:sent?1:0,messages:sent?[{ID:'mail',Created:'2026-10-17T00:00:01Z',To:[{Address:email}]}]:[]})};
  if(url.endsWith('/message/mail'))return {status:200,json:async()=>({ID:'mail',Date:'2026-10-17T00:00:01Z',To:[{Address:email}],Text:`http://localhost:8080/realms/idambox/login-actions/action-token?key=x.${claims}.s`})};
  throw Error('unexpected');
 }});
 const person=await binding.runtime.createUser({username:email.split('@')[0],email}); await binding.runtime.executeActions(person);
 assert.equal((await binding.runtime.queryContract()).defaultSeconds,43200);
});
test('native REST uses the existing container credential expansion and stdin body',async()=>{
 let call;const native=createNativeRest({env:{},start:(program,args,options)=>{call={program,args,options};return{done:Promise.resolve('{"object":{"oid":"native"}}\n200'),close:async()=>{}};}});
 assert.equal((await native.mp('POST','/users/search',{query:{filter:{text:'test'}}})).object.oid,'native');
 assert.ok(call.args.includes('administrator:${MP_SET_midpoint_administrator_initialPassword}')===false);
 assert.ok(call.args.some(value=>value.includes('${MP_SET_midpoint_administrator_initialPassword}')));
 assert.equal(JSON.parse(call.options.input).query.filter.text,'test');
 await assert.rejects(native.mp('GET','/../secret',null));
});
test('native retry reads persisted triggers only from the person’s linked HR or target shadows',async()=>{
 const identityOid='00000000-0000-4000-8000-000000000123';const shadowOid='00000000-0000-4000-8000-000000000124';
 const calls=[];const mp=async(method,endpoint)=>{calls.push([method,endpoint]);
  if(endpoint.includes('/tasks/'))return {oid:oid('300'),activity:{controlFlow:{errorHandling:{entry:{reaction:{retryLater:{initialInterval:'PT5M',nextInterval:'PT15M'}}}}}}};
  if(endpoint.includes('/users/'))return {oid:identityOid,personalNumber:'900001',linkRef:[{oid:shadowOid}]};
  return {oid:shadowOid,resourceRef:{oid:oid('100')},trigger:{handlerUri:'http://midpoint.evolveum.com/xml/ns/public/model/trigger/shadow-reconcile/handler-3',timestamp:'2026-10-17T00:05:00Z'}};
 };
 const retry=await readNativeRetry(mp,{sourceKey:'900001',identityOid});assert.equal(retry.initialSeconds,300);assert.equal(retry.subsequentSeconds,900);assert.equal(retry.persistent,true);
 assert.deepEqual(calls, [['GET',`/tasks/${oid('300')}`],['GET',`/users/${identityOid}`],['GET',`/shadows/${shadowOid}`]]);
 await assert.rejects(readNativeRetry(async()=>({}),{sourceKey:'900001',identityOid}));
});
test('native audit accepts a missing REQUEST event only for a failed run of the expected task',async()=>{
 const person={identityOid:'00000000-0000-4000-8000-000000000123'};const since='2026-10-17T00:05:00.000Z';
 const row=outcome=>JSON.stringify([{id:'9',at:'2026-10-17T00:05:03Z',startedAt:null,taskName:'HR live sync',taskOid:oid('300'),outcome}]);
 const failed=await readNativeAudit(async()=>row('FATAL_ERROR'),person,since,false);
 assert.equal(failed.id,'9');assert.equal(failed.startedAt,since);
 await assert.rejects(readNativeAudit(async()=>row('SUCCESS'),person,since,false),{code:'JOURNEY_CONFLICT_AUDIT_PENDING'});
 await assert.rejects(readNativeAudit(async()=>JSON.stringify([{id:'9',at:'2026-10-17T00:06:00Z',startedAt:null,taskName:'Trigger Scanner',taskOid:'scanner',outcome:'FATAL_ERROR'}]),person,since,true),{code:'JOURNEY_CONFLICT_AUDIT_PENDING'});
});
test('native audit binds identity, time and scanner task; pending evidence cannot pass',async()=>{
 const person={identityOid:'00000000-0000-4000-8000-000000000123'};let query;
 const audit=await readNativeAudit(async(program,args,options)=>{query=options.input;return JSON.stringify([{id:'123',at:'2026-10-17T00:06:00Z',startedAt:'2026-10-17T00:05:01Z',taskName:'Trigger Scanner',taskOid:'scanner',outcome:'success'}]);},person,'2026-10-17T00:05:00Z',true);
 assert.equal(audit.id,'123');assert.ok(query.includes(person.identityOid));assert.ok(!query.includes('UPDATE'));
 await assert.rejects(readNativeAudit(async()=>'[]',person,'2026-10-17T00:05:00Z',true),{code:'JOURNEY_CONFLICT_AUDIT_PENDING'});
});
test('probe administrative program parses without starting a process',()=>{new Script(PROBE_OPERATOR);});
test('conflict binding defaults expose a concrete native runner without imported fixture secrets',()=>{
 const binding=createConflictBinding({env:{...env,IAM_JOURNEY_RUN_DIR:'/private/iam-journey-00000000-0000-4000-8000-abcdef123456'}});
 for(const method of ['preparePerson','assertLocalUnique','createCollision','observeCollision','removeCollision','publishMover','driveNativeTask','awaitNativeRecovery','cleanupPerson'])assert.equal(typeof binding.runtime[method],'function');
 assert.equal(typeof binding.run,'function');
});

test('default probe executes A1–A4 through private HTTP, mailbox, source operator and browser bindings',async()=>{
 const {runKeycloakProbe}=await import('./journey-contract.mjs');
 const users=new Map();const messages=[];const bodies=new Map();let smtp={original:'retained'};let now=Date.parse('2026-10-17T00:00:00Z');let resends=0;let consumed=0;let cleaned=false;
 const mail=user=>{const id=`mail-${messages.length}`;const row={ID:id,Created:new Date(now).toISOString(),To:[{Address:user.email}]};messages.push(row);
  const claims=Buffer.from(JSON.stringify({sub:user.id,iat:now/1000,exp:now/1000+user.lifespan})).toString('base64url');
  bodies.set(id,{...row,Text:`http://localhost:8080/realms/idambox/login-actions/action-token?key=h.${claims}.s`});};
 const response=(status,value,location)=>({status,json:async()=>value,headers:new Headers(location?{location}:{})});
 const binding=createDefaultProbe({env,now:()=>now,pause:async ms=>{now+=ms;},
  smtp:{snapshot:async()=>smtp,set:async value=>{smtp=value;}},
  command:async(program,args)=>{assert.equal(program,'docker');return args[0]==='inspect'?'quay.io/keycloak/keycloak:26.6.1 idp 127.0.0.1:8080 \n':'Keycloak - Version 26.6.1\n';},
  browser:{consume:async({user,receipt})=>{assert.deepEqual(receipt,{received:true,fresh:true});consumed++;users.get(user.id).requiredActions=[];return {consumed:true};}},
  operator:{prepare:async owner=>{const user={id:'sourced',username:`journey-contract-${owner}-99`,email:`journey-contract-${owner}-99@hr.idambox.test`,lifespan:43200};users.set(user.id,user);return {...user,owner,sourceManaged:true,documentId:'source-document'};},
   resend:async user=>{resends++;mail(users.get(user.id));return {accepted:true};},cleanup:async user=>{users.delete(user.id);cleaned=true;}},
  transport:async(url,init)=>{
   const target=new URL(url);const route=target.pathname;
   if(route.endsWith('/token'))return response(200,{access_token:'private',expires_in:60});
   if(route==='/admin/realms/idambox'){if(init.method==='PUT'){smtp=JSON.parse(init.body).smtpServer;return response(204);}return response(200,{smtpServer:smtp});}
   if(route.endsWith('/users')&&init.method==='POST'){const user={...JSON.parse(init.body),id:`fixture-${users.size}`,lifespan:43200};users.set(user.id,user);return response(201,undefined,`http://localhost:8080/admin/realms/idambox/users/${user.id}`);}
   if(route.includes('/users/')){
    const id=route.split('/')[5];const user=users.get(id);assert.ok(user);
    if(route.endsWith('/execute-actions-email')){
     assert.equal(init.method,'PUT');assert.deepEqual(JSON.parse(init.body),['UPDATE_PASSWORD']);
     if(!smtp.host)return response(500);
     if(target.searchParams.get('client_id')==='missing-client'||target.searchParams.get('redirect_uri')?.includes('invalid.test')||(target.searchParams.has('redirect_uri')&&!target.searchParams.has('client_id')))return response(400);
     user.lifespan=Number(target.searchParams.get('lifespan')??43200);mail(user);return response(204);
    }
    if(init.method==='DELETE'){users.delete(id);return response(204);}
    if(init.method==='PUT'){Object.assign(user,JSON.parse(init.body));return response(204);}
    return response(200,user);
   }
   if(route==='/api/v1/messages')return response(200,{total:messages.length,messages});
   if(route.startsWith('/api/v1/message/'))return response(200,bodies.get(route.split('/').at(-1)));
   assert.fail('unexpected private request');
  }});
 const result=await runKeycloakProbe(binding.runtime,{runId:'abcdef123456'});
 assert.deepEqual(result.cases.map(row=>row.case),['A1','A2','A3','A4']);
 assert.equal(result.cases[1].defaultSeconds,43200);assert.equal(resends,2);assert.equal(consumed,1);assert.equal(cleaned,true);assert.equal(users.size,0);assert.deepEqual(smtp,{original:'retained'});
 assert.ok(!JSON.stringify(result).includes('key='));assert.equal(result.liveAcceptance,false);
});

test('probe SMTP control uses the bootstrap administrator for the realm only and refuses a hidden SMTP snapshot',async()=>{
 const calls=[];let hidden=false;
 const admin=createRealmSmtpAdmin({env,read:async()=>({text:'KC_BOOTSTRAP_ADMIN_USERNAME=boot\nKC_BOOTSTRAP_ADMIN_PASSWORD=private-pass\nMIDPOINT_ADMIN_PASSWORD=a\nMIDPOINT_DB_NAME=b\nMIDPOINT_DB_USER=c\nMIDPOINT_DB_PASSWORD=d\nMIDPOINT_SCIM_TOKEN=\n'}),
  transport:async(url,init)=>{calls.push([init.method,new URL(url).pathname]);
   if(url.endsWith('/token')){assert.equal(init.body.get('client_id'),'admin-cli');assert.equal(init.body.get('grant_type'),'password');assert.equal(init.body.get('username'),'boot');return {status:200,json:async()=>({access_token:'private'})};}
   assert.equal(init.headers.Authorization,'Bearer private');
   return init.method==='PUT'?{status:204}:{status:200,json:async()=>(hidden?{}:{smtpServer:{host:'mailpit'}})};}});
 assert.deepEqual(await admin.snapshot(),{host:'mailpit'});await admin.set({});
 assert.deepEqual(calls.filter(([,route])=>!route.endsWith('/token')),[['GET','/admin/realms/idambox'],['PUT','/admin/realms/idambox']]);
 assert.ok(calls.filter(([,route])=>route.endsWith('/token')).every(([,route])=>route==='/realms/master/protocol/openid-connect/token'));
 hidden=true;await assert.rejects(admin.snapshot(),{code:'JOURNEY_CONTRACT_STATUS'});
});

test('container version read refuses a foreign or unpinned Keycloak container',async()=>{
 for(const [owner,text] of [['quay.io/keycloak/keycloak:26.6.0 idp 127.0.0.1:8080','Keycloak - Version 26.6.1\n'],['quay.io/keycloak/keycloak:26.6.1 other 127.0.0.1:8080','Keycloak - Version 26.6.1\n'],['quay.io/keycloak/keycloak:26.6.1 idp 127.0.0.1:8080','Keycloak 26.6.1\n']])
  await assert.rejects(readKeycloakVersion(async(_,args)=>args[0]==='inspect'?owner:text),{code:'JOURNEY_CONTRACT_VERSION'});
 assert.equal(await readKeycloakVersion(async(_,args)=>args[0]==='inspect'?'quay.io/keycloak/keycloak:26.6.1 idp 127.0.0.1:8080 \n':'Keycloak - Version 26.6.1\n'),'26.6.1');
});

for(const defect of ['stale','replacement','ambiguous'])test(`mailbox rejects ${defect} mail against the pre-command baseline`,async()=>{
 const email='journey-contract-abcdef123456-0@hr.idambox.test';let sent=false;
 const old={ID:'old',Created:'2026-10-17T00:00:00Z',To:[{Address:email}]};
 const fresh={...old,ID:'new',Created:defect==='stale'?old.Created:'2026-10-17T00:00:02Z'};
 const mail=createLocalMailbox({now:()=>Date.parse('2026-10-17T00:00:02Z'),transport:async()=>({status:200,json:async()=>({total:sent?2:1,messages:sent?(defect==='replacement'?[fresh,{...fresh,ID:'other'}]:defect==='ambiguous'?[old,fresh,{...fresh,ID:'other'}]:[old,fresh]):[old]})})});
 assert.equal(await mail.count(email),1);sent=true;await assert.rejects(mail.wait(email,1));
});

test('concrete IN-03 binding drives validated CSV and observes native conflict, scanner recovery and cleanup',async()=>{
 const run='abcdef123456';const identityOid='00000000-0000-4000-8000-000000000123';const shadowOid='00000000-0000-4000-8000-000000000124';
 const base=Date.parse('2026-10-17T00:00:00Z');let now=base;let conflictStart;let published;let collision;let collisionRemoved=false;let terminating=false;let taskRun;const calls=[];
 const original='employeeNumber,givenName,familyName,preferredName,email,username,department,jobTitle,status,startDate,endDate\n';
 let person;const email=`journey-${run}-2@hr.idambox.test`;const moved=`journey-${run}-2.moved@hr.idambox.test`;
 const recovered=()=>conflictStart!==undefined&&now>=conflictStart+301000;
 const local=()=>({...person,sourceKey:person.employeeNumber,sourceDocumentId:'source-document',sourceIdentityKey:'source-identity',identityOid,documentId:'local-document',remoteSubject:'person-subject',localMatches:1,email:recovered()?moved:email,accountStatus:terminating?'inactive':'active'});
 const mp=async(method,endpoint)=>{
  calls.push({method,endpoint});
  if(endpoint.endsWith('/run')){const suffix=endpoint.includes(oid('310'))?'310':'300';taskRun={suffix,start:now};if(suffix==='300'&&!terminating)conflictStart=now;return null;}
  if(endpoint.includes('/tasks/')){
   const target=endpoint.replace(/\?include=result$/,'');
   if(taskRun&&target.endsWith(oid(taskRun.suffix)))now=Math.max(now,taskRun.start+1000);
   const suffix=target.endsWith(oid('310'))?'310':'300';const status=suffix==='300'&&!terminating?'partial_error':'success';
   return {oid:oid(suffix),executionState:'runnable',schedulingState:'ready',lastRunStartTimestamp:new Date(taskRun?.start??base).toISOString(),lastRunFinishTimestamp:new Date((taskRun?.start??base)+1000).toISOString(),resultStatus:'success',activityState:{activity:{statistics:{itemProcessing:{processed:[{outcome:{outcome:status==='success'?'success':'failure'},count:1,lastItem:{startTimestamp:new Date(taskRun?.start??base).toISOString()}}]}}}},
    activity:{controlFlow:{errorHandling:{entry:{reaction:{retryLater:{initialInterval:'PT5M',nextInterval:'PT15M'}}}}}}};
  }
  // midPoint wraps REST objects under their type name.
  if(endpoint===`/users/${identityOid}`)return {user:{oid:identityOid,personalNumber:person.employeeNumber,linkRef:[{oid:shadowOid}]}};
  if(endpoint===`/shadows/${shadowOid}`)return {shadow:{oid:shadowOid,resourceRef:{oid:oid('100')},trigger:{handlerUri:'http://midpoint.evolveum.com/xml/ns/public/model/trigger/shadow-reconcile/handler-3',timestamp:new Date(conflictStart+300000).toISOString()}}};
  assert.fail('unexpected native operation');
 };
 const command=async(program,args,options)=>{
  assert.equal(program,'docker');assert.equal(options.capture,true);
  if(args.includes('cat'))return original;
  assert.ok(options.input.includes('JOIN m_object'));assert.ok(options.input.includes("e.eventstage = 'EXECUTION'"));
  assert.ok(!options.input.includes('taskname AS'));
  const scanner=recovered();return JSON.stringify([{id:scanner?'audit-recovery':'audit-error',taskOid:scanner?'00000000-0000-4000-8000-000000000007':oid('300'),taskName:scanner?'Trigger Scanner':'HR live sync',outcome:scanner?'SUCCESS':'PARTIAL_ERROR',startedAt:new Date(conflictStart+(scanner?300050:0)).toISOString(),at:new Date(conflictStart+(scanner?300500:500)).toISOString()}]);
 };
 const transport=async(url,init)=>{
  const route=new URL(url).pathname;const response=(status,value)=>({status,json:async()=>value,headers:new Headers({location:'http://localhost:8080/admin/realms/idambox/users/collision'})});
  if(route.endsWith('/token'))return response(200,{access_token:'private',expires_in:600});
  if(route==='/api/v1/messages')return response(200,{total:1,messages:[{ID:'invite',To:[{Address:email}]}]});
  if(route==='/admin/realms/idambox/users'&&init.method==='POST'){collision={...JSON.parse(init.body),id:'collision'};return response(201);}
  if(route.endsWith('/users/collision')){if(init.method==='DELETE'){assert.ok(collision);collision=undefined;collisionRemoved=true;return response(204);}return response(collision?200:404,collision);}
  if(route.endsWith('/users/person-subject/sessions'))return response(200,[]);
  const remote={id:'person-subject',email:recovered()?moved:email,enabled:!terminating};
  if(route.endsWith('/users/person-subject'))return response(200,remote);
  if(route==='/admin/realms/idambox/users')return response(200,[remote]);
  assert.fail('unexpected remote operation');
 };
 const binding=createConflictBinding({env:{...env,IAM_JOURNEY_RUN_DIR:`/private/iam-journey-00000000-0000-4000-8000-${run}`},mp,command,transport,now:()=>now,pause:async ms=>{now+=ms;},
  publishFile:async text=>{published=text;const rows=text.trim().split('\n');if(rows.length>1){const fields=rows[1].split(',');person={employeeNumber:fields[0],username:fields[5]};terminating=fields[8]==='terminated';}},
  observe:async()=>local(),scim:async query=>{
   if(query.kind==='localUnique'||query.kind==='remoteOnly')return true;
   if(query.status===200&&!recovered())return undefined;
   assert.equal(query.documentId,'local-document');assert.equal(query.method,'PATCH');return {origin:'connector',documentId:query.documentId,method:'PATCH',status:query.status,retryAfterSeconds:query.status===503?30:0,requestId:query.status===503?'request-error':'request-recovery',at:new Date(conflictStart+(query.status===503?100:300100)).toISOString()};
  }});
 const proof=await binding.run();
 assert.equal(proof.recovered,true);assert.equal(proof.rollback,true);assert.equal(collisionRemoved,true);assert.equal(terminating,true);assert.equal(published,original);
 assert.equal(calls.filter(row=>row.endpoint.endsWith('/run')).length,3);
 assert.ok(calls.every(row=>!row.endpoint.endsWith('/resume')));
 assert.ok(Date.parse(proof.retryTriggeredAt)>=Date.parse(proof.retryScheduledAt));
});

test('administration program uses the existing identity and revocation service signatures',async()=>{
 const path=await import('node:path');const {EventEmitter}=await import('node:events');
 const events=[];const processMock=new EventEmitter();Object.assign(processMock,{env:{},umask:()=>{},cwd:()=>'/private/backend',stdout:{write:()=>{}},stderr:{write:()=>{}},exit:()=>assert.fail('unexpected exit'),send:reply=>events.push(reply)});
 const user={documentId:'local-person',externalSubject:'remote-person'};let created=false;let inactive=false;const remoteCalls=[];
 const app={load:async()=>{},destroy:async()=>{},documents:uid=>{assert.equal(uid,'api::idambox-user.idambox-user');return {findOne:async()=>user};}};
 const modules={
  'bootstrap/boot-mode.js':{markAdministrationBoot:()=>{}},'bootstrap/seed-core-data.js':{seedCoreData:async()=>{}},'bootstrap/seed-csrm-data.js':{seedCapabilityCatalogue:async()=>{}},
  'iam/identity/source-registration.js':{registerIdentitySource:async()=>({documentId:'source'})},'iam/identity/source-principal.js':{resolveSourcePrincipal:async()=>({sourceDocumentId:'source'})},
  'iam/identity/identity-service.js':{createFromSource:async(actual,principal,input)=>{assert.equal(actual,app);assert.equal(principal.sourceDocumentId,'source');assert.equal(input.accountStatus,'active');assert.ok(!('password' in input));created=true;return {ok:true,value:user};},createIdentityService:actual=>{assert.equal(actual,app);return {deactivateFromSource:async(principal,target,deletion)=>{assert.equal(target,user.documentId);assert.equal(deletion,true);inactive=true;return {ok:true};}};}},
  'iam/password-setup/service.js':{resendPasswordSetupEmail:async(actual,id)=>{assert.equal(actual,app);assert.equal(id,user.documentId);return {outcome:'sent',reason:'accepted'};}},
  'keycloak/config.js':{readKeycloakProvisioningConfig:()=>({})},'keycloak/admin-client.js':{KeycloakAdminClient:class{async disableUser(id){remoteCalls.push(['disable',id]);}async endUserSessions(id){remoteCalls.push(['logout',id]);}}},
 };
 const script=new Script(PROBE_OPERATOR);
 script.runInNewContext({process:processMock,require:name=>{
  if(name==='node:path')return path;
  if(name==='@strapi/strapi')return {compileStrapi:async()=>({distDir:'/private/dist'}),createStrapi:()=>app};
  const key=name.replace('/private/dist/src/','');assert.ok(modules[key],key);return modules[key];
 }});
 for(let i=0;i<10&&!events.some(row=>row.ready);i++)await Promise.resolve();assert.equal(events[0].ready,true);
 const invoke=async(action,value)=>{await processMock.listeners('message')[0]({id:action,action,value});return events.at(-1);};
 const prepared=await invoke('prepare','abcdef123456');assert.equal(prepared.ok,true);assert.equal(created,true);assert.equal(prepared.value.id,user.externalSubject);
 assert.equal((await invoke('resend',{documentId:'other'})).ok,false);
 assert.equal((await invoke('resend',{documentId:user.documentId})).value.accepted,true);
 assert.equal((await invoke('cleanup',{documentId:'other'})).ok,false);assert.equal(inactive,false);
 assert.equal((await invoke('cleanup',{documentId:user.documentId})).ok,true);assert.equal(inactive,true);
 assert.deepEqual(remoteCalls,[['disable',user.externalSubject],['logout',user.externalSubject]]);
});

test('action browser consumes only the private Mailpit link and closes on success or failure',async()=>{
 const {createActionConsumer}=await import('./journey-bindings.mjs');
 for(const broken of [false,true]){
  const events=[];const signal=new AbortController().signal;
  const field={fill:async value=>{assert.ok(value.length>30);events.push('fill');},count:async()=>0};
  const page={setDefaultTimeout:()=>{},goto:async url=>{assert.equal(url,'private-action');if(broken)throw Error('private-action');},getByLabel:()=>field,getByRole:role=>role==='link'?{count:async()=>1,click:async()=>events.push('proceed')}:{click:async()=>events.push('submit')},locator:()=>({waitFor:async()=>events.push('complete')})};
  const consumer=createActionConsumer({action:()=> 'private-action'},()=>({chromium:{launch:async()=>({newContext:async options=>{assert.equal(options.acceptDownloads,false);return {newPage:async()=>page};},close:async()=>events.push('close')})}}));
  if(broken)await assert.rejects(consumer.consume({receipt:{},signal}),error=>error.code==='JOURNEY_CONTRACT_BROWSER'&&!error.message.includes('private-action'));
  else { assert.deepEqual(await consumer.consume({receipt:{},signal}),{consumed:true}); assert.deepEqual(events.slice(0,2),['proceed','fill']); }
  assert.equal(events.at(-1),'close');
 }
});

test('task error observation requires native failure status and accepts handled native subresults',async()=>{
 const {hasNativeItemFailure}=await import('./journey-bindings.mjs');
 const task=(outcome,start)=>({resultStatus:'success',activityState:{activity:{statistics:{itemProcessing:{processed:[{outcome:{outcome},count:1,lastItem:{startTimestamp:start}}]}}}}});
 const since=Date.parse('2026-10-17T00:05:00Z');
 assert.equal(hasNativeItemFailure(task('failure','2026-10-17T00:05:01Z'),since),true);
 assert.equal(hasNativeItemFailure(task('failure','2026-10-17T00:04:59Z'),since),false);
 assert.equal(hasNativeItemFailure(task('success','2026-10-17T00:05:01Z'),since),false);
 assert.equal(hasNativeItemFailure({resultStatus:'success',message:'some error text'},since),false);
});

test('embedded listener and administration programs keep direct IdamBoxUser Document Service access read-only',async()=>{
 const {createRequire}=await import('node:module');const {readFile}=await import('node:fs/promises');
 const ts=createRequire(new URL('../../../apps/backend/package.json',import.meta.url))('typescript');const {LISTENER}=await import('./journey-runtime.mjs');
 const programs=[LISTENER,PROBE_OPERATOR,await readFile(new URL('./journey-access.mjs',import.meta.url),'utf8')];let reads=0;
 for(const source of programs){
  const tree=ts.createSourceFile('program.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const visit=node=>{
   if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='documents'
    &&node.arguments[0]?.text==='api::idambox-user.idambox-user'){
    assert.ok(ts.isPropertyAccessExpression(node.parent));assert.ok(['findMany','findOne','findFirst','count'].includes(node.parent.name.text),'direct user writes must stay in the identity service');reads++;
   }
   ts.forEachChild(node,visit);
  };visit(tree);
 }
 assert.ok(reads>=5);
});
