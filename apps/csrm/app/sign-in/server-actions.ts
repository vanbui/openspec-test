'use server';

import { redirect } from 'next/navigation';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { validatedReturnTo } from '@/lib/auth/return-to';
import { requireDevelopmentRole } from '@/lib/auth/session-adapter';

export async function completeDevelopmentSignIn(formData: FormData): Promise<never> {
  const role = requireDevelopmentRole(formData.get('role'));
  const returnTo = validatedReturnTo(formData.get('returnTo')?.toString());

  await getSessionAdapter().setDevelopmentRole(role);
  redirect(returnTo);
}
