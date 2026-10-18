import { GuardedLink } from '../csrm/navigation-guard';
import { BrandLockup } from './brand-lockup';

/*
 * The name begins with the visible word (WCAG 2.5.3 Label in Name), so a speech-input user who says
 * "BProton" reaches the link, and a screen reader still hears where it goes. It asks first while the page
 * has unsaved answers (UI-SPEC §6.3).
 */
export function Wordmark() {
  return <GuardedLink aria-label="BProton, IdamBox CSRM home" className="wordmark" href="/app"><BrandLockup /></GuardedLink>;
}
