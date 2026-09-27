'use client';
import { useId, useTransition } from 'react';
import { setDevelopmentRole } from '../../../app/actions/session';
import type { DevelopmentRole } from '@/lib/auth/session-adapter';

export function RoleSwitcher({ role }: { role: DevelopmentRole }) {
  const [pending, startTransition] = useTransition();
  // The shell renders this twice (sidebar and navigation sheet), so each copy needs its own id for
  // its label to name its own select.
  const selectId = useId();
  return (
    <form
      className="role-switcher"
      action={(formData) => startTransition(() => setDevelopmentRole(formData))}
    >
      <label className="micro-label" htmlFor={selectId}>
        Development role
      </label>
      <select
        id={selectId}
        name="role"
        defaultValue={role}
        disabled={pending}
        onChange={(event) => {
          const form = event.currentTarget.form;
          if (form) {
            const data = new FormData(form);
            startTransition(() => setDevelopmentRole(data));
          }
        }}
      >
        <option>Requestor</option>
        <option>Secondary Requestor</option>
        <option>Security Analyst</option>
      </select>
      <p>Development-only UI fixture. Strapi remains the authorization authority.</p>
    </form>
  );
}
