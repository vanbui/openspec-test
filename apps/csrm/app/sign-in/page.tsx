import { ShieldCheckIcon } from 'lucide-react';

import type { Metadata } from 'next';
import { BrandLockup } from '@/components/shell/wordmark';
import { Button } from '@/components/ui/button';
import { resolveSessionRuntimeMode } from '@/lib/auth/development-runtime';
import { validatedReturnTo } from '@/lib/auth/return-to';
import { completeDevelopmentSignIn } from './server-actions';

interface SignInPageProps {
  searchParams: Promise<{ returnTo?: string }>;
}

function developmentSessionAvailable(): boolean {
  return resolveSessionRuntimeMode(process.env) === 'development';
}

export async function generateMetadata(): Promise<Metadata> {
  return developmentSessionAvailable()
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

export default async function SignIn({ searchParams }: SignInPageProps) {
  if (!developmentSessionAvailable()) {
    return <SignInUnavailable />;
  }

  const { returnTo } = await searchParams;
  const safeReturnTo = validatedReturnTo(returnTo);

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
