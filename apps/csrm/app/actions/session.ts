'use server';

import { revalidatePath } from 'next/cache';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { requireDevelopmentRole } from '@/lib/auth/session-adapter';

export async function setDevelopmentRole(formData: FormData): Promise<void> {
  const role = requireDevelopmentRole(formData.get('role'));

  await getSessionAdapter().setDevelopmentRole(role);
  revalidatePath('/app', 'layout');
}
