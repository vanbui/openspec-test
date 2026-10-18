/** Private lifecycle proof through the ordinary mounted API; no route or authority is added. */
import { createHash } from 'node:crypto';
const fail = () => { throw Object.assign(new Error('JOURNEY_ACCESS_INVALID'),{code:'JOURNEY_ACCESS_INVALID'}); };
const need = value => { if (!value) fail(); };
export const REQUEST_OPERATIONS = Object.freeze({access:'GET:/api/v1/me/access',list:'GET:/api/v1/my_requests',
  create:'POST:/api/csrm-assessment-requests',read:'GET:/api/csrm-assessment-requests/{id}',write:'PUT:/api/csrm-assessment-requests/{id}'});
export function requestorOperations(catalogue) {
 const roles=catalogue.roles.filter(row=>row.id==='role.requestor'); need(roles.length===1);
 const ids=new Set(roles[0].functionIds);
 need(['GET:/api/v1/dashboard/summary','GET:/api/v1/risk_types'].every(operation=>catalogue.functionApis.some(row=>row.url===operation&&!ids.has(row.functionId))));
 const operations=[...new Set(catalogue.functionApis.filter(row=>ids.has(row.functionId)).map(row=>row.url))].sort();
 need(Object.values(REQUEST_OPERATIONS).every(operation=>operations.includes(operation))); return operations;
}
export function assertRequestorAccess(payload,expected) {
 const actual=payload?.data?.operations;
 need(Array.isArray(actual)&&new Set(actual).size===actual.length&&JSON.stringify([...actual].sort())===JSON.stringify(expected)); return true;
}
export function assertImmediateRefusal(proof,now=Date.now()) {
 need(proof?.cryptographicallyValid===true&&proof.remainingLifetimeMs>0&&Date.parse(proof.accessTokenExpiresAt)>now
  &&Date.parse(proof.observedAt)<=now&&Date.parse(proof.observedAt)<Date.parse(proof.accessTokenExpiresAt)
  &&proof.remoteEnabled===true&&proof.remoteSessions>0&&proof.outboxStatus==='pending'&&proof.accountStatus==='inactive'
  &&[proof.accessStatus,proof.detailStatus,proof.writeStatus].every(value=>value===403));return true;
}
export function createAccessDriver({app,mod,env,catalogue,admin,transport=fetch,now=Date.now}) {
 const expected=requestorOperations(catalogue); const tokens=new Map(); const people=new Map();
 const verify=mod('keycloak/access-token-verifier.js').createAccessTokenVerifier({issuer:env.KEYCLOAK_ISSUER,clientId:env.KEYCLOAK_TOKEN_CLIENT_ID??'idambox-csrm',requestTimeoutMs:5000});
 let apiToken;
 const original = token => { try { return JSON.parse(Buffer.from(token.split('.')[1],'base64url')); } catch { fail(); } };
 async function person(employeeNumber) {
  need(/^\d{6,12}$/.test(employeeNumber)); const rows=await app.documents('api::idambox-user.idambox-user').findMany({filters:{sourceExternalId:employeeNumber},populate:{roles:true,identitySource:true},limit:2});
  need(rows.length===1&&rows[0].roles.length===0&&rows[0].identitySource&&rows[0].externalSubject); return rows[0];
 }
 async function session(row) {
  const token=tokens.get(row.externalSubject); need(token); need(await verify(token)===row.externalSubject);
  const expires=original(token).exp*1000; need(Number.isSafeInteger(expires)&&expires-now()>32000);
  return {token,expires,key:createHash('sha256').update(token).digest('hex')};
 }
 async function request(token,path,method='GET',body) {
  need(path.startsWith('/api/')&&!path.includes('://'));
  const response=await transport(`http://127.0.0.1:1337${path}`,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${apiToken}`,'x-csrm-identity-token':token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,json:()=>response.json()};
 }
 const success = response => { need(response.status===200); return response; };
 return {
  async initialize() { apiToken=(await app.service('admin::api-token-content-api').create({name:'Journey private web',description:'Disposable journey',type:'full-access',lifespan:null})).accessKey;need(apiToken);return apiToken; },
  async capture(ctx) {
   if(ctx.path!=='/api/v1/me/access'||ctx.get('authorization')!==`Bearer ${apiToken}`)return;
   const token=ctx.get('x-csrm-identity-token'); if(!token)return;
   const subject=await verify(token); const prior=tokens.get(subject);
   // Retain the first independently verified token. A later refresh cannot masquerade as the retained session.
   if(!prior)tokens.set(subject,token);
  },
  async prepare(employeeNumber) {
   const row=await person(employeeNumber);need(row.accountStatus==='active'); const auth=await session(row);
   const access=success(await request(auth.token,'/api/v1/me/access')); assertRequestorAccess(await access.json(),expected);
   need(!people.has(employeeNumber));
   const created=await request(auth.token,'/api/csrm-assessment-requests','POST',{data:{title:'Journey draft request',assessmentType:'BAU'}});
   need(created.status===201||created.status===200); const owned=(await created.json()).data;need(/^[a-z0-9]{24}$/.test(owned?.documentId));
   // A second sourced human owns the foreign record. Its creation uses the existing identity service.
   const source=await mod('iam/identity/source-principal.js').resolveSourcePrincipal(app,row.identitySource.documentId);need(source);
   const tag=auth.key.slice(0,12); const identity=await mod('iam/identity/identity-service.js').createFromSource(app,source,{username:`journey.${tag}.foreign`,email:`journey-contract-${tag}-97@hr.idambox.test`,firstName:'Journey',lastName:'Foreign',displayName:'Journey Foreign',accountStatus:'active',sourceExternalId:`journey-foreign-${tag}`});need(identity.ok);
   const foreign=await app.service('api::csrm-assessment-request.csrm-assessment-request').create({data:{requestNumber:`JOURNEY-${tag}`,title:'Journey foreign request',requestStatus:'draft',requestor:identity.value.documentId,assessmentType:'BAU'}});
   need(/^[a-z0-9]{24}$/.test(foreign.documentId));
   const detail=`/api/csrm-assessment-requests/${owned.documentId}`;
   success(await request(auth.token,'/api/v1/my_requests'));
   success(await request(auth.token,detail));success(await request(auth.token,detail,'PUT',{data:{title:'Journey owner request'}}));
   need((await success(await request(auth.token,detail)).json()).data?.title==='Journey owner request');
   need((await request(auth.token,`/api/csrm-assessment-requests/${foreign.documentId}`)).status===403);
   need((await request(auth.token,'/api/v1/dashboard/summary')).status===403);
   need((await request(auth.token,'/api/v1/risk_types')).status===403);
   const proof={sessionKey:auth.key,accessTokenExpiresAt:new Date(auth.expires).toISOString(),detail:`/app/requests/${owned.documentId}`,list:'/app/requests',restricted:'/app/review/requests',administration:'/app/admin/risk-types',foreign:`/app/requests/${foreign.documentId}`,
    operations:{...REQUEST_OPERATIONS},restrictedOperations:['GET:/api/v1/dashboard/summary','GET:/api/v1/risk_types'],requestorOnly:true,restrictedApisRefused:true,foreignRecordRefused:true};
   people.set(employeeNumber,{proof,detail,subject:row.externalSubject,sourceKey:row.sourceExternalId,documentId:row.documentId});return proof;
  },
  async mover(employeeNumber) {
   const row=await person(employeeNumber);const prior=people.get(employeeNumber);need(prior&&row.documentId===prior.documentId&&row.externalSubject===prior.subject&&row.sourceExternalId===prior.sourceKey&&row.accountStatus==='active');
   const auth=await session(row);need(auth.key===prior.proof.sessionKey);assertRequestorAccess(await success(await request(auth.token,'/api/v1/me/access')).json(),expected);
   success(await request(auth.token,prior.detail));success(await request(auth.token,prior.detail,'PUT',{data:{title:'Journey owner request'}}));return prior.proof;
  },
  async refuse(employeeNumber) {
   const row=await person(employeeNumber);const prior=people.get(employeeNumber);need(prior&&row.documentId===prior.documentId&&row.externalSubject===prior.subject);
   const auth=await session(row);need(auth.key===prior.proof.sessionKey);const outbox=await app.documents('api::keycloak-sync-outbox.keycloak-sync-outbox').findFirst({filters:{userDocumentId:row.documentId}});
   const statuses=[];for(const [path,method,body] of [['/api/v1/me/access','GET'],[prior.detail,'GET'],[prior.detail,'PUT',{data:{title:'Forbidden'}}]]) statuses.push((await request(auth.token,path,method,body)).status);
   // Verify after the ordinary API probes too, before checking that remote logout has not happened.
   need(await verify(auth.token)===row.externalSubject);const remote=await admin.json(`/users/${row.externalSubject}`);const sessions=await admin.json(`/users/${row.externalSubject}/sessions`);
   const observedAt=new Date(now()).toISOString();const proof={...prior.proof,cryptographicallyValid:true,observedAt,remainingLifetimeMs:auth.expires-now(),remoteEnabled:remote.enabled,remoteSessions:sessions.length,outboxStatus:outbox?.syncStatus,accountStatus:row.accountStatus,accessStatus:statuses[0],detailStatus:statuses[1],writeStatus:statuses[2],beforeRemoteLogout:true};
   assertImmediateRefusal(proof,now());return proof;
  },
 };
}
