---
phase: quick-260930-iei
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/csrm/src/components/shell/account-initials.ts
  - apps/csrm/src/components/shell/account-initials.test.ts
  - apps/csrm/src/components/shell/account-menu.tsx
  - apps/csrm/src/components/shell/app-shell.tsx
  - apps/csrm/src/components/shell/app-shell-account.test.tsx
  - apps/csrm/src/lib/auth/session-adapter.ts
  - apps/csrm/src/lib/auth/oidc-session-adapter.ts
  - apps/csrm/src/lib/auth/oidc-session-adapter.test.ts
  - apps/csrm/app/(app)/layout.tsx
  - apps/csrm/src/components/shell/sign-out-form.tsx
  - apps/csrm/app/globals.css
  - apps/csrm/README.md
autonomous: true
requirements: [ACCT-01, ACCT-02, ACCT-03, ACCT-04]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "With CSRM_AUTH_OIDC_ENABLED=true, the top bar shows a circular button with the signed-in user's initials at its right edge at desktop and mobile widths; the sidebar and the mobile navigation sheet no longer show the old footer caption or a Sign out button (ACCT-01)"
    - "Clicking (or pressing Enter/ArrowDown on) the initials button opens a menu that repeats the same circular initials avatar beside two lines: the user's name, then the user's email address; the email line is omitted when absent or identical to the name (ACCT-02)"
    - "The menu's 'Sign out' item shows a sign-out icon and the text 'Sign out', and submits the existing signOutOfSession server action, so the RP-initiated Keycloak logout (clear Auth.js cookie, redirect to end-session) is unchanged; the menu stays mounted until the action redirects (ACCT-03)"
    - "With CSRM_AUTH_OIDC_ENABLED false or unset, the shell is unchanged: the development role switcher stays in the bottom-left sidebar footer and mobile sheet, the header role tag stays, and no account menu renders (ACCT-04)"
    - "The trigger's accessible name contains the visible initials (WCAG 2.5.3 Label in Name, axe label-content-name-mismatch), it is keyboard operable, and its touch target is at least 44px below 768px"
  artifacts:
    - path: apps/csrm/src/components/shell/account-initials.ts
      provides: "Pure accountInitials(displayName) helper: up to two uppercase initials, email-aware, '?' fallback"
      contains: "export function accountInitials"
    - path: apps/csrm/src/components/shell/account-menu.tsx
      provides: "Client AccountMenu: shadcn DropdownMenu + Avatar trigger, identity label, Sign out form item"
      contains: "signOutOfSession"
    - path: apps/csrm/src/components/shell/app-shell.tsx
      provides: "Header renders AccountMenu when an OIDC account is present; footer holds only the role switcher"
      contains: "AccountMenu"
    - path: apps/csrm/src/lib/auth/oidc-session-adapter.ts
      provides: "OIDC Session now carries the trimmed email claim for display"
      contains: "email"
  key_links:
    - from: "apps/csrm/app/(app)/layout.tsx"
      to: "AppShell account prop"
      via: "{ displayName, email } built from the OIDC Session only when resolveSessionRuntimeMode(process.env) === 'oidc'"
      pattern: "email"
    - from: apps/csrm/src/components/shell/app-shell.tsx
      to: apps/csrm/src/components/shell/account-menu.tsx
      via: "<AccountMenu> rendered as the last child of <header className=\"header\">"
      pattern: "AccountMenu"
    - from: apps/csrm/src/components/shell/account-menu.tsx
      to: apps/csrm/app/actions/session.ts
      via: "<form action={signOutOfSession}> wrapping the Sign out DropdownMenuItem submit button"
      pattern: "action=\\{signOutOfSession\\}"
---

<objective>
Move the OIDC-mode account control from the sidebar footer to the top-right of the top bar, as a circular initials button that opens an account menu. The menu shows the same initials avatar beside the user's name and email address, then a "Sign out" item with an icon that reuses the existing RP-initiated sign-out. Development mode (OIDC off) stays exactly as it is.

Requirement IDs, local to this quick task:
- ACCT-01: In OIDC mode, a circular initials button sits at the top right of the header at every width, and the old sidebar/mobile-sheet footer control is gone.
- ACCT-02: The dropdown shows the same avatar plus two lines: the name, then the email.
- ACCT-03: The "Sign out" item (sign-out icon plus text) invokes the existing `signOutOfSession` action, so the Keycloak end-session flow is unchanged.
- ACCT-04: With OIDC off, the shell is unchanged: role switcher bottom-left, role tag in the header, no account menu.

Interpretation (planner's discretion; the task gives no locked D-XX decisions): "username" means the name the shell already shows, `Session.displayName`. That is Keycloak's `name` claim, which Auth.js falls back to `preferred_username` when `name` is absent. Showing the raw Keycloak `preferred_username` separately would mean changing the security-sensitive Auth.js jwt/session callbacks, and this plan does not do that. If the operator wants the literal Keycloak login name, a follow-up can carry `preferred_username` through the jwt callback's `profile` into the session.

Purpose: A premium, conventional account affordance in the top bar for real (Keycloak) deployments, with no change to the development workflow agents use.
Output: `account-initials.ts` (+ test), a client `account-menu.tsx`, the header wiring in `app-shell.tsx`, the email carried on the OIDC `Session`, the footer form component and its CSS retired, and the README walkthrough updated.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@apps/csrm/AGENTS.md
@docs/design/csrm-design-direction.md
@apps/csrm/src/components/shell/app-shell.tsx
@apps/csrm/src/components/shell/sign-out-form.tsx
@apps/csrm/src/components/shell/app-shell-account.test.tsx
@apps/csrm/src/components/ui/dropdown-menu.tsx
@apps/csrm/src/components/ui/avatar.tsx
@apps/csrm/app/actions/session.ts
@apps/csrm/app/(app)/layout.tsx
@apps/csrm/src/lib/auth/session-adapter.ts
@apps/csrm/src/lib/auth/oidc-session-adapter.ts

<interfaces>
Existing contracts the executor builds on (verified during planning, do not re-explore):

- `AppShell({ children, granted, role?, account? })` in `apps/csrm/src/components/shell/app-shell.tsx` is a Server Component (no 'use client'). Today `account?: { displayName: string }`, and `role` and `account` are mutually exclusive. `footer = roleSwitcher ?? (account ? <the footer form component> : undefined)` renders in `<aside className="sidebar">` inside `.shell-footer`, and it is also passed to `<MobileNavigation footer={footer} granted={granted} />`. The header is `<header className="header">` with the MobileNavigation trigger, `<span className="header-title">`, and in dev mode only `<span className="header-role micro-label">{role}</span>`.
- The `.header` CSS (`apps/csrm/app/globals.css` ~line 628) is `display:flex; justify-content:space-between`. `.header-title` is hidden below 768px, and `.mobile-trigger` shows only below 1024px.
- `signOutOfSession(): Promise<never>` is a 'use server' action in `apps/csrm/app/actions/session.ts`. It delegates to `getSessionAdapter().signOut()`, which in OIDC mode clears the Auth.js cookie and redirects to Keycloak end-session. Existing tests mock it via `vi.mock('../../../app/actions/session', () => ({ setDevelopmentRole: vi.fn(), signOutOfSession: vi.fn() }))`.
- shadcn primitives present (`"use client"`, radix-ui based): `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent` (already `rounded-lg border bg-popover shadow-overlay`, portalled), `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem` (supports `asChild`, `onSelect`) from `@/components/ui/dropdown-menu`; `Avatar` (`size` default|sm|lg, `rounded-full`), `AvatarFallback` (`bg-muted text-muted-foreground`) from `@/components/ui/avatar`; `Button` (`variant` ghost, `size` icon = `size-9`, always `rounded-full`, focus-visible ring) from `@/components/ui/button`.
- `lucide-react` 1.30.0 exports `LogOut`. No package install is needed or allowed in this plan.
- `Session` in `apps/csrm/src/lib/auth/session-adapter.ts`: `{ displayName: string; developmentRole?: DevelopmentRole }`. `OidcSessionAdapter.current()` computes `displayName = user.name?.trim() || user.email?.trim() || 'Signed-in user'` and returns `{ displayName }`. The Auth.js session callback already exposes `user.name` and `user.email` and nothing else. Leave that callback unchanged.
- `apps/csrm/app/(app)/layout.tsx` builds `account = resolveSessionRuntimeMode(process.env) === 'oidc' ? { displayName: session.displayName } : undefined` and passes it to both `AppShell` renders (normal and PermissionDeniedState). The layout is `force-dynamic`.
- jsdom has no ResizeObserver, and Radix Popper needs one. Use `installTestResizeObserver()` from `@/test/layout-stubs` in `beforeEach` and `vi.unstubAllGlobals()` in `afterEach`.
- Vitest pins `CSRM_AUTH_OIDC_ENABLED=false`, and Playwright pins it off too. No e2e can exercise OIDC mode, so unit tests carry the OIDC assertions.
</interfaces>
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): OIDC account menu in the top bar, from AppShell to the sign-out action</name>
  <files>apps/csrm/src/components/shell/account-initials.ts, apps/csrm/src/components/shell/account-initials.test.ts, apps/csrm/src/components/shell/account-menu.tsx, apps/csrm/src/components/shell/app-shell.tsx, apps/csrm/src/components/shell/app-shell-account.test.tsx</files>
  <read_first>
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/components/shell/app-shell-account.test.tsx
    - apps/csrm/src/components/ui/dropdown-menu.tsx
    - apps/csrm/src/components/ui/avatar.tsx
    - apps/csrm/src/test/layout-stubs.ts (installTestResizeObserver)
    - apps/csrm/node_modules/next/dist/docs/01-app/02-guides/forms.md (server action form in a Client Component, per the Next.js 16 agent rule in apps/csrm/AGENTS.md)
    - docs/design/csrm-design-direction.md sections "Buttons" (icon-only buttons are circles; touch targets of at least 44px below 768px), "AppShell / sidebar" (top bar), radius table (avatars use --radius-full; menus use --radius-lg + --shadow-overlay)
  </read_first>
  <behavior>
    - account-initials.test.ts: accountInitials('Jane Doe') is 'JD'; '  jane   doe ' is 'JD'; 'Jane Mary Doe' is 'JD' (first + last word); 'Jane' is 'J'; 'jane.doe@idambox.com' is 'JD' (email local part split on . _ -); 'bob@idambox.com' is 'B'; 'émile zola' is 'ÉZ' (locale uppercase, code-point safe); '' is '?'; a string with no letter or digit (e.g. '— —') is '?'.
    - app-shell-account.test.tsx, OIDC case (account={{ displayName: 'Jane Doe' }}): inside screen.getByRole('banner') there is a button named exactly 'JD, account menu for Jane Doe'; the sidebar has no .shell-footer; the old footer caption text is absent; before opening, no 'Sign out' element exists.
    - Same case: after userEvent click on the trigger, a role="menu" is present that contains the text 'Jane Doe' and a menuitem named 'Sign out' holding an aria-hidden svg; clicking that menuitem leads to the mocked signOutOfSession being called once (await waitFor).
    - Dev case (role="Requestor", no account): the role switcher combobox 'Development role' is still present, no button whose name matches /account menu/, no 'Sign out'.
    - Neither role nor account: no .shell-footer, no account menu button, no 'Sign out'.
  </behavior>
  <action>
Write the failing tests first (RED), then implement (GREEN). Use no new dependency and no shadcn CLI run; dropdown-menu, avatar, lucide-react and radix-ui are already installed.

1. Create apps/csrm/src/components/shell/account-initials.ts, exporting a pure `accountInitials(displayName: string): string` with no React import and no 'server-only' (a client module imports it). Behaviour:
   - Trim the input.
   - If it contains '@' and no whitespace, use only the local part before '@' and treat '.', '_' and '-' as word separators. Otherwise split on whitespace.
   - For each word, keep its first letter-or-digit code point (match with the Unicode property class for letters and numbers under the 'u' flag). Drop words that have none.
   - Take the first word's character, plus the last word's when there are two or more, joined and passed through toLocaleUpperCase().
   - Return '?' when nothing usable remains.
   - Iterate by code point (Array.from or spread), never by UTF-16 index.
   This keeps the logic out of JSX, per AGENTS.md "Business/domain logic must not live in JSX".

2. Create apps/csrm/src/components/shell/account-menu.tsx as a Client Component ('use client').
   - Why a client component: the Sign out item needs an onSelect handler. This app ships no exit-animation keyframes, so Radix unmounts closed menu content right away. That would disconnect the submit button before the browser runs form submission, and sign-out would silently not happen on a pointer click. Calling event.preventDefault() in the item's onSelect keeps the menu, and its form, mounted until the server action redirects to Keycloak.
   - Props: `{ displayName: string; email?: string }`. Compute `initials = accountInitials(displayName)`.
   - Trigger: DropdownMenuTrigger asChild wrapping the shared Button with variant="ghost", size="icon", aria-label set to the template `${initials}, account menu for ${displayName}` (the visible initials start the name: WCAG 2.5.3 Label in Name, axe label-content-name-mismatch runs in e2e/accessibility.spec.ts), and className "ml-auto p-0 max-md:size-11" (36px circle on desktop, 44px touch target below 768px; ml-auto pins it right even when the title is hidden).
   - Inside the trigger: Avatar containing AvatarFallback with the initials. Give AvatarFallback "bg-muted text-foreground text-xs font-medium" for ink-on-muted contrast. Use semantic tokens only, never a hex or brand colour.
   - DropdownMenuContent: align="end", className "w-64" (Tailwind spacing, so it fits a 375px viewport).
   - Identity block: DropdownMenuLabel with className "flex items-center gap-2 font-normal". It holds a second Avatar with the same initials, marked aria-hidden="true" because it duplicates the trigger. Beside it, a "grid min-w-0 flex-1 leading-tight" column: line 1 is the displayName in a "truncate font-medium text-foreground" span. Line 2 is the email in a "truncate text-xs text-muted-foreground" span, rendered only when email is non-empty and different from displayName (Task 2 supplies email; the prop is optional now).
   - Then a DropdownMenuSeparator.
   - Sign out: a form element with action={signOutOfSession}, imported via the relative path '../../../app/actions/session' so the existing vi.mock path matches. Inside it, DropdownMenuItem asChild with onSelect={(event) => event.preventDefault()}, wrapping a button of type="submit" with className "w-full". The button contains the lucide LogOut icon with aria-hidden="true", then the text "Sign out". Its accessible name is exactly "Sign out".
   - Render displayName and email only as React text children, never as injected HTML.

3. Edit apps/csrm/src/components/shell/app-shell.tsx (it stays a Server Component):
   - Remove the retired footer component's import and usage. `footer` becomes the role switcher only (undefined when there is no role), so in OIDC mode neither the sidebar nor the MobileNavigation sheet renders a footer.
   - Render `<AccountMenu displayName={account.displayName} email={account.email} />` as the last child of the header, only when `account` is set.
   - Widen the `account` prop type to `{ displayName: string; email?: string }` and keep the doc comment that it is mutually exclusive with `role`.
   - Dev-mode markup (role switcher footer, header role tag) must stay byte-identical (ACCT-04).

4. Rewrite the OIDC describe block in apps/csrm/src/components/shell/app-shell-account.test.tsx to the new behaviour. Keep the existing next/navigation, next/link and session-action mocks. Import signOutOfSession from the mocked module to assert calls. Add beforeEach installTestResizeObserver() and afterEach vi.unstubAllGlobals(), and use userEvent.setup(). If a pointer click fails to open the menu in jsdom, open it by focusing the trigger and pressing Enter; do not add global polyfills to src/test/setup.ts. Keep the dev-mode and neither-mode describe blocks and add their account-menu absence assertions. Do not reference the old footer caption string in any new production file.
  </action>
  <verify>
    <automated>pnpm --filter @csrm/web exec vitest run account-initials app-shell-account mobile-navigation role-switcher && pnpm --filter @csrm/web typecheck</automated>
  </verify>
  <done>In OIDC mode, AppShell renders a circular initials button at the right of the header. It opens a menu with the avatar, the name and a "Sign out" menuitem, and choosing that item calls signOutOfSession. The sidebar and mobile sheet have no footer in OIDC mode. Dev mode is unchanged. The named vitest files and typecheck pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Carry the OIDC email claim to the account menu's second line</name>
  <files>apps/csrm/src/lib/auth/session-adapter.ts, apps/csrm/src/lib/auth/oidc-session-adapter.ts, apps/csrm/src/lib/auth/oidc-session-adapter.test.ts, apps/csrm/app/(app)/layout.tsx, apps/csrm/src/components/shell/app-shell-account.test.tsx</files>
  <read_first>
    - apps/csrm/src/lib/auth/session-adapter.ts
    - apps/csrm/src/lib/auth/oidc-session-adapter.ts (current(), lines ~64-81)
    - apps/csrm/src/lib/auth/oidc-session-adapter.test.ts ("OidcSessionAdapter.current" describe, ~line 167)
    - apps/csrm/app/(app)/layout.tsx
  </read_first>
  <behavior>
    - oidc-session-adapter.test.ts: user { name: ' Jane Doe ', email: ' jane.doe@idambox.com ' } resolves { displayName: 'Jane Doe', email: 'jane.doe@idambox.com' }; user { name: ' Jane Doe ' } resolves exactly { displayName: 'Jane Doe' } (no email key); user { name: '', email: 'jane.doe@idambox.com' } resolves { displayName: 'jane.doe@idambox.com', email: 'jane.doe@idambox.com' }; user {} resolves { displayName: 'Signed-in user' }; null session and the refresh-failure session still resolve null.
    - app-shell-account.test.tsx: with account={{ displayName: 'Jane Doe', email: 'jane.doe@idambox.com' }}, the opened menu shows 'Jane Doe' and 'jane.doe@idambox.com' as two separate lines; with account={{ displayName: 'jane.doe@idambox.com', email: 'jane.doe@idambox.com' }}, the address appears once in the menu label (no duplicate line).
  </behavior>
  <action>
Write the updated and new test expectations first, then implement.

1. In apps/csrm/src/lib/auth/session-adapter.ts, add an optional `email?: string` to the Session interface. Its doc comment should say it is set by OIDC sessions only (ADR 0003), is the user's own Keycloak email claim, is used only for display in the account menu, and never for authorisation (Strapi resolves identity from the access token, docs/adr/0004). The development adapter does not set it; leave development-session-adapter.ts untouched.

2. In apps/csrm/src/lib/auth/oidc-session-adapter.ts current():
   - Compute a trimmed email from user.email.
   - Return { displayName } plus an email key only when the trimmed email is non-empty (conditional spread), so sessions without an email keep their exact current shape.
   - Keep the refresh-failure and null-user early returns and the displayName fallback chain unchanged.
   - Do not touch oidc-auth-options.ts: the session callback already exposes only expires, name and email, and must keep stripping everything else.

3. In apps/csrm/app/(app)/layout.tsx, build the OIDC-only account as { displayName: session.displayName } plus email via conditional spread when session.email is set, still gated on resolveSessionRuntimeMode(process.env) === 'oidc'. Keep `export const dynamic = 'force-dynamic'`, which is what stops a user's email from being served from a shared render cache. Pass the same account to both AppShell renders, including the PermissionDeniedState one, so a denied user can still reach Sign out.

4. Update the existing "resolves the display name…" test case in oidc-session-adapter.test.ts to the new shapes, add the name-plus-email case, and add the two email display cases to app-shell-account.test.tsx. AccountMenu already renders the second line conditionally from Task 1; adjust it only if a new assertion fails.
  </action>
  <verify>
    <automated>pnpm --filter @csrm/web exec vitest run oidc-session-adapter app-shell-account development-session-adapter && pnpm --filter @csrm/web typecheck</automated>
  </verify>
  <done>The OIDC Session carries the trimmed email when Keycloak provides one. The layout forwards it only in OIDC mode. The menu shows the name and the email on two lines without duplicating an email-only identity. The Auth.js callbacks and the development adapter are unchanged. The tests and typecheck pass.</done>
</task>

<task type="auto">
  <name>Task 3: Retire the sidebar sign-out form, update the OIDC walkthrough, and run the full gate</name>
  <files>apps/csrm/src/components/shell/sign-out-form.tsx, apps/csrm/app/globals.css, apps/csrm/README.md</files>
  <read_first>
    - apps/csrm/app/globals.css (~lines 509-519: the rule block under the comment "The OIDC-mode shell footer (ADR 0003)")
    - apps/csrm/README.md (section "(b) Keycloak OIDC", step 6)
  </read_first>
  <action>
1. Delete the retired footer form component file listed in files (under apps/csrm/src/components/shell). After Task 1 nothing imports it; confirm with a repository grep for its component name before deleting.

2. In apps/csrm/app/globals.css, remove the whole OIDC-mode footer rule block: the comment line "The OIDC-mode shell footer (ADR 0003)…" and the two selectors under it, the form rule and its nested micro-label rule. Leave `.shell-footer`, `.role-switcher` and every other rule untouched; the development footer still depends on them. No new CSS is needed, since the account menu uses Tailwind utilities on semantic tokens and the dropdown primitive already carries the menu radius and overlay shadow. The existing print rule already hides `.header` and `[data-radix-popper-content-wrapper]`.

3. In apps/csrm/README.md, section "(b) Keycloak OIDC", replace step 6 with: open the account menu (your initials, top right of the screen) and choose "Sign out", which ends the Keycloak session and returns to http://localhost:3000. Change nothing else in the README. Leave docs/adr/0003 as it is: its statements that the user sees their name and "Sign out" remain true.

4. Run the full web gate: lint, typecheck and the whole vitest suite.
   - Stage only the files listed in this plan's files_modified. Do not stage the pre-existing unrelated changes apps/backend/types/generated/contentTypes.d.ts or apps/csrm/next-env.d.ts.
   - If `next dev` re-adds the nextjs-agent-rules block to apps/csrm/AGENTS.md, leave that file out of this commit.
  </action>
  <verify>
    <automated>pnpm --filter @csrm/web lint && pnpm --filter @csrm/web typecheck && pnpm --filter @csrm/web test && test ! -f apps/csrm/src/components/shell/sign-out-form.tsx && ! grep -q "sign-out-form" apps/csrm/app/globals.css && ! grep -rq "SignOutForm" apps/csrm/src apps/csrm/app && grep -q "account menu" apps/csrm/README.md</automated>
    <human-check>Optional, needs the local Keycloak in idp/. With CSRM_AUTH_OIDC_ENABLED=true, sign in as jane.doe and check the following at 1440px and 375px. The initials circle sits at the top right. It opens a menu with the avatar, name and email. Mouse-clicking "Sign out" lands on Keycloak logout and then returns to http://localhost:3000. Then, with the flag false, confirm the role switcher is still bottom-left.</human-check>
  </verify>
  <done>The retired footer component and its CSS are gone. The README walkthrough points to the top-right account menu. `pnpm --filter @csrm/web lint`, `typecheck` and `test` all pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Keycloak ID token claims to Auth.js session to Server Component | The name and email claims are user-controlled profile data, rendered in the shell |
| Browser to Next.js server action | The Sign out submission crosses to `signOutOfSession`, which runs server-side |
| Server Component to Client Component (RSC payload) | displayName and email serialize into the signed-in user's own page payload |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-q260930-01 | Tampering | account-menu.tsx rendering name/email | medium | mitigate | Name and email render only as React text children (auto-escaped); no injected HTML. Initials come from string operations in account-initials.ts |
| T-q260930-02 | Information disclosure | app/(app)/layout.tsx passing email to the client | low | mitigate | Email is the viewer's own claim, already present in the Auth.js session. The layout keeps `dynamic = 'force-dynamic'`, so the payload is never shared across users. The email is never logged. The Auth.js session callback is not changed and still strips every token and `sub` |
| T-q260930-03 | Repudiation / Spoofing | Sign out menu item (shared-machine session left active) | medium | mitigate | `onSelect` calls `preventDefault()` so the menu and its form stay mounted until the server action redirects. Otherwise Radix unmounts content right away (no exit keyframes) and a pointer click would silently skip submission. A unit test asserts `signOutOfSession` is invoked from the menuitem. The logout path itself (`OidcSessionAdapter.signOut`: `assertOidcRuntime`, cookie clear, Keycloak end-session with id_token_hint) is reused unchanged |
| T-q260930-04 | Elevation of privilege | AppShell account vs role rendering | low | mitigate | The account menu renders only when `account` is set, which the layout builds only when `resolveSessionRuntimeMode(process.env) === 'oidc'`. The menu is presentation; authorisation stays server-side in Strapi (navigation visibility is not security). Tests assert no account menu in dev mode |
| T-q260930-SC | Tampering | npm/pnpm installs | low | accept | No package is installed: dropdown-menu, avatar, lucide-react and radix-ui are already dependencies. No shadcn CLI run and no lockfile change |
</threat_model>

<verification>
- `pnpm --filter @csrm/web lint && pnpm --filter @csrm/web typecheck && pnpm --filter @csrm/web test` passes, run from the repository root.
- The account-initials unit tests cover multi-word names, single words, email fallbacks, accents and empty input.
- The app-shell-account tests prove OIDC mode (header menu, identity lines, sign-out action invoked, no footer) and development mode (role switcher footer unchanged, no account menu).
- The oidc-session-adapter tests prove the email is carried only when present.
- The retired footer component file and its CSS are gone, with no remaining references.
</verification>

<success_criteria>
- ACCT-01: In OIDC mode, a circular initials button is at the top right of the top bar at desktop and mobile widths, and no footer sign-out remains in the sidebar or mobile sheet.
- ACCT-02: The menu shows the same initials avatar beside the name and the email, on two lines.
- ACCT-03: The "Sign out" item (LogOut icon plus text) submits `signOutOfSession`, and the Keycloak RP-initiated logout is unchanged.
- ACCT-04: With OIDC off, the shell renders exactly as before.
- The trigger's accessible name begins with the visible initials, keyboard operation works, the touch target is at least 44px below 768px, only semantic tokens are used, and no new dependency is added.
</success_criteria>

<output>
Create `.planning/quick/260930-iei-when-csrm-auth-oidc-enabled-true-move-th/260930-iei-SUMMARY.md` when done
</output>
