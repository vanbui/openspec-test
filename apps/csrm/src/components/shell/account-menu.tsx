'use client';

import { LogOut } from 'lucide-react';
import { useRef } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { signOutOfSession } from '../../../app/actions/session';
import { useNavigationGuard } from '../csrm/navigation-guard';
import { accountInitials } from './account-initials';

interface AccountMenuProps {
  displayName: string;
  email?: string;
}

const AVATAR_FALLBACK_CLASS = 'bg-muted text-foreground text-xs font-medium';

/**
 * The OIDC-mode account control (ADR 0003): a circular initials button at the top right of the
 * header that opens the signed-in identity and the Sign out action. Presentation only; Strapi
 * enforces authorisation.
 */
export function AccountMenu({ displayName, email }: AccountMenuProps) {
  const initials = accountInitials(displayName);
  const showEmail = Boolean(email) && email !== displayName;
  /*
   * Signing out ends the session before the browser leaves, so unsaved answers could neither be saved nor
   * kept. While the page has unsaved work, Sign out asks first, like a link (UI-SPEC §6.3).
   */
  const guard = useNavigationGuard();
  const form = useRef<HTMLFormElement>(null);
  const leaveChosen = useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`${initials}, account menu for ${displayName}`}
          className="ml-auto p-0 max-md:size-11"
          size="icon"
          variant="ghost"
        >
          <Avatar>
            <AvatarFallback className={AVATAR_FALLBACK_CLASS}>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2 font-normal">
          <Avatar aria-hidden="true">
            <AvatarFallback className={AVATAR_FALLBACK_CLASS}>{initials}</AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium text-foreground">{displayName}</span>
            {showEmail ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*
          The form must stay mounted until the server action redirects: without preventDefault Radix
          unmounts the closed menu at once and a pointer click would never submit the form.
        */}
        <form
          action={signOutOfSession}
          onSubmit={(event) => {
            if (leaveChosen.current || !guard.blocking) return;
            const trigger = (event.nativeEvent as SubmitEvent).submitter;
            guard.guardLink(event, {
              trigger: trigger instanceof HTMLElement ? trigger : null,
              onLeave: () => {
                leaveChosen.current = true;
                form.current?.requestSubmit();
              },
            });
          }}
          ref={form}
        >
          <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
            <button className="w-full" type="submit">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
