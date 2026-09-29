import { signOutOfSession } from '../../../app/actions/session';
import { Button } from '../ui/button';

/**
 * The OIDC-mode account footer (ADR 0003), shown in the same shell slot the
 * development role switcher occupies: the two never render together, since
 * `AppShell` only receives one of `role` or `account`.
 */
export function SignOutForm({ displayName }: { displayName: string }) {
  return (
    <form action={signOutOfSession} className="sign-out-form">
      <p className="micro-label">Signed in as {displayName}</p>
      <Button className="h-control-h" type="submit" variant="outline">Sign out</Button>
    </form>
  );
}
