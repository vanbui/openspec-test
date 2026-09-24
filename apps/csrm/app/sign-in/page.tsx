import { ShieldCheckIcon } from 'lucide-react';

import { notFound } from 'next/navigation';
import { BrandLockup } from '@/components/shell/wordmark';
import { Button } from '@/components/ui/button';
import { validatedReturnTo } from '@/lib/auth/return-to';
import { parseSessionRuntimeMode } from '@/lib/auth/session-adapter';
import { completeDevelopmentSignIn } from './server-actions';

interface SignInPageProps {
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function SignIn({ searchParams }: SignInPageProps) {
  if (parseSessionRuntimeMode(process.env.NODE_ENV) !== 'development') {
    notFound();
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
