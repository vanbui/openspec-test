<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CSRM Engineering Rules

- Use Next.js App Router and TypeScript.
- TypeScript strict mode is mandatory.
- Prefer Server Components; use Client Components only when required.
- Use shadcn/ui before creating custom primitives.
- All styling must use semantic theme tokens.
- Never hard-code BProton brand colours in feature components.
- All pages must work at mobile and desktop widths.
- Business/domain logic must not live in JSX.
- Never call APIs directly from arbitrary UI components; use the typed API layer.
- Validate external input with shared schemas.
- Authorization must be enforced server-side.
- Navigation visibility is not authorization.
- Requestors must not access another requestor's restricted records.
- AI output is advisory and cannot automatically release an assessment.
- Use the supplied JDL terminology as the domain source of truth.
- Add automated tests with every material workflow.
- Do not introduce a dependency without a concrete reason.
- Prefer maintainability and clarity over clever abstractions.
