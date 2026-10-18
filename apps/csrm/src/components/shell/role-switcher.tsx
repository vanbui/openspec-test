'use client';
import { useId, useTransition } from 'react';
import { setDevelopmentRole } from '../../../app/actions/session';
import type { DevelopmentRole } from '@/lib/auth/session-adapter';
import { useNavigationGuard } from '../csrm/navigation-guard';

export function RoleSwitcher({ role }: { role: DevelopmentRole }) {
  const [pending, startTransition] = useTransition();
  // The shell renders this twice (sidebar and navigation sheet), so each copy needs its own id for
  // its label to name its own select.
  const selectId = useId();
  /*
   * Switching re-renders the page under another identity, so while answers wait to be saved it asks first,
   * like every other in-app navigation (WR-305): the waiting answers are never sent as someone else.
   */
  const guard = useNavigationGuard();
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
          const select = event.currentTarget;
          const form = select.form;
          if (!form) return;
          const data = new FormData(form);
          const chosen = select.value;
          const switchRole = () => {
            select.value = chosen;
            startTransition(() => setDevelopmentRole(data));
          };
          if (!guard.blocking) {
            switchRole();
            return;
          }
          // Until the person chooses to leave, the select keeps showing the identity in use.
          select.value = role;
          guard.guardLink({ preventDefault() {} }, { trigger: select, onLeave: switchRole });
        }}
      >
        <option>Requestor</option>
        <option>Secondary Requestor</option>
        <option>Security Analyst</option>
        <option>Second Security Analyst</option>
      </select>
      <p>Development-only UI fixture. Strapi remains the authorization authority.</p>
    </form>
  );
}
