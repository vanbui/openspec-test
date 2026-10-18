import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestorOperations, assertRequestorAccess, assertImmediateRefusal, createAccessDriver } from './journey-access.mjs';
const catalogue=JSON.parse(await readFile(new URL('../../../docs/references/idambox-csrm-role-function-api-catalogue.json',import.meta.url),'utf8'));
test('Requestor operation equality rejects missing, duplicate and elevated operations',()=>{
 const expected=requestorOperations(catalogue);assert.equal(assertRequestorAccess({data:{operations:expected}},expected),true);
 for(const actual of [expected.slice(1),[...expected,expected[0]],[...expected,'GET:/api/roles']])assert.throws(()=>assertRequestorAccess({data:{operations:actual}},expected));
});
test('immediate refusal requires unexpired proof and remote access still present during all API refusals',()=>{
 const now=Date.parse('2026-10-17T00:00:00Z');const proof={cryptographicallyValid:true,remainingLifetimeMs:60000,accessTokenExpiresAt:new Date(now+60000).toISOString(),observedAt:new Date(now).toISOString(),remoteEnabled:true,remoteSessions:1,outboxStatus:'pending',accountStatus:'inactive',accessStatus:403,detailStatus:403,writeStatus:403};
 assert.equal(assertImmediateRefusal(proof,now),true);
 for(const patch of [{cryptographicallyValid:false},{remoteEnabled:false},{remoteSessions:0},{writeStatus:200},{outboxStatus:'completed'},{accessTokenExpiresAt:new Date(now).toISOString()}])assert.throws(()=>assertImmediateRefusal({...proof,...patch},now));
});
test('access driver uses ordinary API credentials and keeps the first verified session token for later refusal',async()=>{
 const now=Date.parse('2026-10-17T00:00:00Z');const old=`h.${Buffer.from(JSON.stringify({exp:(now+120000)/1000})).toString('base64url')}.old`;const refreshed=old.replace('.old','.new');
 const person={documentId:'a'.repeat(24),sourceExternalId:'900000000001',identitySource:{documentId:'source'},externalSubject:'subject',accountStatus:'active',roles:[]};const calls=[];
 const app={documents:uid=>{
  if(uid==='api::idambox-user.idambox-user')return {findMany:async()=>[person]};
  assert.equal(uid,'api::keycloak-sync-outbox.keycloak-sync-outbox');return {findFirst:async()=>({syncStatus:'pending'})};
 },service:uid=>uid==='admin::api-token-content-api'?{create:async()=>({accessKey:'outer-private'})}:{create:async()=>({documentId:'c'.repeat(24)})}};
 const modules={'keycloak/access-token-verifier.js':{createAccessTokenVerifier:()=>async token=>{assert.ok([old,refreshed].includes(token));return 'subject';}},
  'iam/identity/source-principal.js':{resolveSourcePrincipal:async()=>({sourceDocumentId:'source'})},'iam/identity/identity-service.js':{createFromSource:async()=>({ok:true,value:{documentId:'foreign-person'}})}};
 const driver=createAccessDriver({app,mod:name=>modules[name],env:{KEYCLOAK_ISSUER:'http://localhost:8080/realms/idambox'},catalogue,now:()=>now,
  admin:{json:async route=>route.endsWith('/sessions')?[{}]:{enabled:true}},transport:async(url,init)=>{
   assert.ok(!url.includes('/scim/'));assert.equal(init.headers.Authorization,'Bearer outer-private');assert.equal(init.headers['x-csrm-identity-token'],old);calls.push({url,method:init.method});
   const status=person.accountStatus==='inactive'||url.endsWith('/api/v1/risk_types')||url.endsWith('/api/v1/dashboard/summary')||url.endsWith('c'.repeat(24))?403:200;
   return {status,json:async()=>url.endsWith('/api/v1/me/access')?{data:{operations:requestorOperations(catalogue)}}:{data:{documentId:'b'.repeat(24),title:'Journey owner request'}}};
  }});
 await driver.initialize();const ctx=token=>({path:'/api/v1/me/access',get:name=>name==='authorization'?'Bearer outer-private':token});
 await driver.capture(ctx(old));await driver.capture(ctx(refreshed));const proof=await driver.prepare(person.sourceExternalId);
 assert.equal(proof.requestorOnly,true);assert.equal(proof.foreignRecordRefused,true);assert.equal((await driver.mover(person.sourceExternalId)).sessionKey,proof.sessionKey);
 person.accountStatus='inactive';const refusal=await driver.refuse(person.sourceExternalId);assert.equal(refusal.beforeRemoteLogout,true);assert.equal(refusal.writeStatus,403);
 assert.ok(calls.some(row=>row.method==='PUT'));
 assert.ok(calls.some(row=>row.url.endsWith('/api/v1/my_requests')));
 assert.ok(calls.some(row=>row.url.endsWith('/api/v1/risk_types')));
 assert.ok(!calls.some(row=>row.url.endsWith('/api/roles')));
 assert.equal(proof.operations.write,'PUT:/api/csrm-assessment-requests/{id}');
 assert.equal(proof.administration,'/app/admin/risk-types');assert.ok(!JSON.stringify(proof).includes(old));
});
