/** Request-local, read-only observations for the disposable connector listener. */
import { AsyncLocalStorage } from 'node:async_hooks';
const need = value => { if (!value) throw Object.assign(new Error('JOURNEY_OBSERVATION_INVALID'),{code:'JOURNEY_OBSERVATION_INVALID'}); };
export function createScimObserver(sourceToken, now = Date.now) {
  need(typeof sourceToken === 'string' && sourceToken.length > 0);
  const scope = new AsyncLocalStorage(); const completed = [];
  return {
    log(text) {
      try {
        const row = JSON.parse(text);
        if (row.event === 'scim.request' && scope.getStore()) scope.getStore().event = {...row,at:new Date(now()).toISOString()};
      } catch { /* Unrelated logs are not SCIM evidence. */ }
    },
    run: (ctx,next) => scope.run({},async()=>{
      await next();
      const match = /^\/scim\/v2\/Users\/([a-z0-9]{24})$/.exec(ctx.path);
      const create = ctx.path === '/scim/v2/Users' && ctx.method === 'POST' && ctx.status === 201;
      const documentId = create ? ctx.body?.id : match?.[1];
      const row = scope.getStore().event;
      if (!/^[a-z0-9]{24}$/.test(documentId ?? '') || ctx.get('authorization') !== `Bearer ${sourceToken}` || !row?.source
        || (create ? row.target !== null : row.target !== documentId) || row.operation !== `${ctx.method}:/scim/v2/Users${create ? '' : '/:id'}`
        || row.status !== ctx.status || !/^[A-Za-z0-9_-]{1,128}$/.test(row.requestId)) return;
      need(completed.length < 1024);
      completed.push({origin:'connector',documentId,requestId:row.requestId,method:ctx.method,status:ctx.status,
        retryAfterSeconds:Number(ctx.response.get('Retry-After')),at:row.at});
    }),
    find(query) {
      need(typeof query?.documentId === 'string' && ['POST','PUT','PATCH'].includes(query.method)
        && Number.isFinite(Date.parse(query.since)) && Number.isInteger(query.status));
      const row = completed.find(row=>row.documentId===query.documentId && row.method===query.method
        && row.status===query.status && Date.parse(row.at)>=Date.parse(query.since));
      return row ? {...row} : undefined;
    },
  };
}
