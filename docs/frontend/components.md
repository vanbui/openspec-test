<!-- generated-by: gsd-doc-writer -->
# Frontend components

## Overview

The App Router composes pages from feature modules. Shared components provide reusable accessible primitives and shell behaviour; feature components render validated domain data. Services and Server Actions own the server interaction. Paths below are relative to the repository root.

## Module listing

| Area | Location | Purpose |
|---|---|---|
| UI primitives | `apps/csrm/src/components/ui/` | Buttons, inputs, dialogs, sheets, tables, badges and toasts |
| Shell | `apps/csrm/src/components/shell/` | Capability navigation, account menu, quick find and application frame |
| Shared CSRM patterns | `apps/csrm/src/components/csrm/` | Page header, local time and navigation guard |
| State presentations | `apps/csrm/src/components/states/` | Loading, empty, error and permission-denied states |
| Requests | `apps/csrm/src/features/requests/` | Request form, hub, lifecycle and typed service |
| Assessments | `apps/csrm/src/features/assessments/` | Readiness, draft jobs, risk and control editing |
| AI assistance | `apps/csrm/src/features/ai-assistance/` | Advisory notices, source display, provenance and decisions |
| Attachments | `apps/csrm/src/features/attachments/` | File state, upload/download and AI inclusion UI |
| Request notes | `apps/csrm/src/features/request-notes/` | Composer, attributed notes and unread state |
| Risks | `apps/csrm/src/features/risks/` | Risk Register and filters |

## Key interfaces

`AppShell` in `apps/csrm/src/components/shell/app-shell.tsx` accepts children, a readonly capability set, promised navigation counts and the viewer time zone. Development role and OIDC account props represent mutually exclusive modes. An identity key separates viewer-specific search state.

`Button` in `apps/csrm/src/components/ui/button.tsx` combines native button props with variant and size choices; asChild composes another element through Radix Slot.

`RetryableErrorState` in `apps/csrm/src/components/states/retryable-error-state.tsx` accepts density, description, headingLevel and noun. It refreshes the current route through its own client router, so a Server Component can display it without passing a callback.

## Usage examples

Use the shared button and retry presentation inside feature composition:

```tsx
import { Button } from '@/components/ui/button';
import { RetryableErrorState } from '@/components/states/retryable-error-state';

export function SaveControl() {
  return <Button type="submit">Save</Button>;
}

export function FailedRead() {
  return <RetryableErrorState noun="assessment" description="Try loading the assessment again." />;
}
```

Route composition calls a feature service such as `getRequest()` in `apps/csrm/src/features/requests/request-service.ts`, checks the result, and renders a feature component. Do not introduce API calls into arbitrary shared UI.

## Design and accessibility

Use semantic tokens from `apps/csrm/app/globals.css` and the [Design direction](../design/csrm-design-direction.md). Preserve responsive layouts, keyboard focus, labels and reduced motion. Keep business/domain calculations outside JSX and grant decisions on the server. A hidden navigation item is not a security control.

See [Testing](../guides/testing.md) for component and browser coverage.
