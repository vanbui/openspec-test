import test from 'node:test';
import assert from 'node:assert/strict';
import { createScimObserver } from './journey-observations.mjs';
const documentId='a'.repeat(24);const at='2026-10-17T00:00:00Z';
const context=(status,headers={authorization:'Bearer source-private'})=>({path:`/scim/v2/Users/${documentId}`,method:'PUT',status,
 get:name=>headers[name]??'',response:{get:()=>status===503?'30':''}});
const event=(status,requestId)=>JSON.stringify({event:'scim.request',source:'registered-source',target:documentId,operation:'PUT:/scim/v2/Users/:id',status,requestId});
const query=status=>({documentId,method:'PUT',status,since:at});
test('concurrent requests to the same target retain their own native request identifiers and Retry-After',async()=>{
 const observer=createScimObserver('source-private',()=>Date.parse(at));let release;const held=new Promise(resolve=>{release=resolve;});
 const first=observer.run(context(503),async()=>{observer.log(event(503,'failed-request'));await held;});
 await observer.run(context(200),async()=>observer.log(event(200,'recovered-request')));release();await first;
 assert.equal(observer.find(query(503)).requestId,'failed-request');assert.equal(observer.find(query(503)).retryAfterSeconds,30);
 assert.equal(observer.find(query(200)).requestId,'recovered-request');
 assert.ok(!JSON.stringify(observer.find(query(503))).includes('source-private'));
});
for(const headers of [{'x-csrm-identity':'developer'},{authorization:'Bearer web-private'},{authorization:'Bearer source-private-other'}])test('non-source authentication cannot supply connector evidence',async()=>{
 const observer=createScimObserver('source-private',()=>Date.parse(at));
 await observer.run(context(503,headers),async()=>observer.log(event(503,'request')));assert.equal(observer.find(query(503)),undefined);
});
test('missing, mismatched, unrelated and stale logs cannot supply a successful observation',async()=>{
 const observer=createScimObserver('source-private',()=>Date.parse(at));observer.log(event(503,'outside-request'));
 await observer.run(context(503),async()=>{});assert.equal(observer.find(query(503)),undefined);
 await observer.run(context(200),async()=>observer.log(event(503,'wrong-status')));assert.equal(observer.find(query(200)),undefined);
 await observer.run(context(503),async()=>observer.log(event(503,'valid-request')));
 assert.equal(observer.find({...query(503),since:'2026-10-17T00:00:01Z'}),undefined);
 const proof=observer.find(query(503));proof.requestId='mutated';assert.equal(observer.find(query(503)).requestId,'valid-request');
});
