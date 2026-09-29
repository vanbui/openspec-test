import { ShieldCheckIcon } from 'lucide-react';

import type { Metadata } from 'next';
import { BrandLockup } from '@/components/shell/wordmark';
import { Button } from '@/components/ui/button';
import { resolveSessionRuntimeMode } from '@/lib/auth/development-runtime';
import { validatedReturnTo } from '@/lib/auth/return-to';
import { beginOidcSignIn, completeDevelopmentSignIn } from './server-actions';

interface SignInPageProps {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const mode = resolveSessionRuntimeMode(process.env);

  if (mode === 'oidc') return { title: 'Sign in | IdamBox CSRM' };
  return mode === 'development'
    ? { title: 'Development sign-in | IdamBox CSRM' }
    : { title: 'Sign-in unavailable | IdamBox CSRM' };
}

/*
 * Without an available development session the page is the fail-closed landing
 * for every unauthenticated visitor: the same card frame, no form, no button,
 * and copy that names no development feature, fixture role or internal system.
 */
function SignInUnavailable() {
  return (
    <main className="sign-in">
      <section className="sign-in-card">
        <p className="wordmark"><BrandLockup /></p>
        <p className="micro-label sign-in-eyebrow">
          <ShieldCheckIcon aria-hidden="true" />
          IdamBox CSRM
        </p>
        <h1>Sign-in unavailable</h1>
        <p className="sign-in-lead">
          Session authentication is not configured. Contact your administrator.
        </p>
        <p className="sign-in-note">
          Access is granted by your organisation’s authorization service, never by navigation alone.
        </p>
      </section>
    </main>
  );
}

/*
 * The production-only Keycloak OIDC sign-in card (ADR 0003). It never names
 * "development", "Strapi" or a fixture identity: the copy is the same whether this
 * runs in a customer's Keycloak or the local `idp/` realm.
 */
function OidcSignIn({ returnTo, error }: { returnTo: string; error?: string }) {
  return (
    <main className="sign-in">
      <section className="sign-in-card">
        <p className="wordmark"><BrandLockup /></p>
        <p className="micro-label sign-in-eyebrow">
          <ShieldCheckIcon aria-hidden="true" />
          IdamBox CSRM
        </p>
        <h1>Sign in</h1>
        <p className="sign-in-lead">
          Continue with your organisation’s IdamBox account.
        </p>
        {error ? (
          <p className="sign-in-error" role="alert">
            Sign-in did not complete. Try again or contact your administrator.
          </p>
        ) : null}
        <form action={beginOidcSignIn} className="sign-in-actions">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button className="h-control-h" type="submit">Continue to IdamBox sign-in</Button>
        </form>
        <p className="sign-in-note">
          Access is granted by your organisation’s authorization service, never by navigation alone.
        </p>
      </section>
    </main>
  );
}

export default async function SignIn({ searchParams }: SignInPageProps) {
  const mode = resolveSessionRuntimeMode(process.env);

  if (mode === 'unavailable') {
    return <SignInUnavailable />;
  }

  const { returnTo, error } = await searchParams;
  const safeReturnTo = validatedReturnTo(returnTo);

  if (mode === 'oidc') {
    return <OidcSignIn returnTo={safeReturnTo} error={error} />;
  }

  return (
    <main className="sign-in">
      <section className="sign-in-card">
        <p className="wordmark"><BrandLockup /></p>
        <p className="micro-label sign-in-eyebrow">
          <ShieldCheckIcon aria-hidden="true" />
          IdamBox CSRM
        </p>
        <h1>Development sign-in</h1>
        <p className="sign-in-lead">
          Choose the fixture identity to continue as. The selected role is sent with every request
          so you see the same records that identity is authorised to see.
        </p>
        <form action={completeDevelopmentSignIn} className="sign-in-actions">
          <input type="hidden" name="returnTo" value={safeReturnTo} />
          <Button className="h-control-h" name="role" type="submit" value="Requestor">Continue as Requestor</Button>
          <Button name="role" type="submit" value="Secondary Requestor" variant="outline" className="h-control-h">Continue as Secondary Requestor</Button>
          <Button name="role" type="submit" value="Security Analyst" variant="outline" className="h-control-h">Continue as Security Analyst</Button>
        </form>
        <p className="sign-in-note">
          Strapi remains the authorization authority: navigation and actions never grant access on
          their own. This screen exists only in development.
        </p>
      </section>
    </main>
  );
}
