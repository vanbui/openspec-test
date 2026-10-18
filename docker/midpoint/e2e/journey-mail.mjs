import { setTimeout as delay } from 'node:timers/promises';

const fail = code => { throw new Error(code); };
export function selectFreshMessage(messages, { recipient, after, seen = new Set() }) {
  if (!/^journey-[a-f0-9]{12}-[0-2]@hr\.idambox\.test$/.test(recipient ?? '') || !Number.isFinite(Date.parse(after)) || !Array.isArray(messages)) fail('JOURNEY_MAIL_INVALID');
  const matches = messages.filter(row => typeof row?.ID === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(row.ID)
    && !seen.has(row.ID) && Number.isFinite(Date.parse(row.Created)) && Date.parse(row.Created) > Date.parse(after)
    && row.To?.length === 1 && row.To[0]?.Address === recipient && !row.Cc?.length && !row.Bcc?.length);
  if (matches.length > 1) fail('JOURNEY_MAIL_AMBIGUOUS');
  return matches[0];
}
export function validateActionUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'http://localhost:8080' || url.username || url.password || url.hash
      || url.pathname !== '/realms/idambox/login-actions/action-token'
      || url.searchParams.getAll('key').length !== 1 || !url.searchParams.get('key')) throw Error();
    return url.href;
  } catch { fail('JOURNEY_MAIL_LINK_INVALID'); }
}
export function extractActionUrl(message) {
  const content = `${message?.Text ?? ''}\n${message?.HTML ?? ''}`;
  if (content.length > 1048576) fail('JOURNEY_MAIL_INVALID');
  const candidates = [...new Set((content.match(/https?:\/\/[^\s<>"']+/g) ?? [])
    .filter(value => value.includes('/login-actions/action-token')).map(value => value.replaceAll('&amp;', '&')))];
  if (candidates.length !== 1) fail(candidates.length ? 'JOURNEY_MAIL_AMBIGUOUS' : 'JOURNEY_MAIL_LINK_INVALID');
  return validateActionUrl(candidates[0]);
}
/** Private return values must never be copied into public observations. */
export async function awaitPasswordMail({ recipient, after, seen = new Set(), transport = fetch,
  now = Date.now, pause = delay, timeoutMs = 120000, signal } = {}) {
  try {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) fail('JOURNEY_MAIL_INVALID');
    const end = now() + timeoutMs;
    const get = async endpoint => {
      const response = await transport(`http://127.0.0.1:8025/api/v1/${endpoint}`, {
        redirect: 'error', signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(Math.max(1, Math.min(10000, end - now())))]) });
      if (!response.ok) fail('JOURNEY_MAIL_FAILED');
      return response.json();
    };
    for (;;) {
      signal?.throwIfAborted();
      if (now() >= end) fail('JOURNEY_MAIL_TIMEOUT');
      const listing = await get('messages?limit=100&start=0');
      // Refuse truncated selection rather than silently accepting an arbitrary page.
      if (!Number.isInteger(listing.total) || listing.total > 100 || listing.total !== listing.messages?.length) fail('JOURNEY_MAIL_INVALID');
      const row = selectFreshMessage(listing.messages, { recipient, after, seen });
      if (row) {
        const message = await get(`message/${encodeURIComponent(row.ID)}`);
        // Details carry the header Date, not Mailpit's receipt time; freshness comes from the listing row.
        if (message?.ID !== row.ID || selectFreshMessage([{ ...message, Created: row.Created }], { recipient, after, seen })?.ID !== row.ID) fail('JOURNEY_MAIL_INVALID');
        const actionUrl = extractActionUrl(message);
        seen.add(row.ID);
        return { actionUrl, messageId: row.ID };
      }
      await pause(Math.min(500, Math.max(1, end - now())), undefined, { signal });
    }
  } catch (error) {
    fail(/^JOURNEY_MAIL_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'JOURNEY_MAIL_FAILED');
  }
}
