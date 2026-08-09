import type { IdentitySnapshot } from "@/domain/identity";

export function AppHeader({ identity }: { identity: IdentitySnapshot | null }) {
  return (
    <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-end border-b border-border-subtle bg-surface px-md lg:pl-[272px] lg:pr-xl">
      <div aria-label="Account context" className="min-w-0 text-right">
        <p className="truncate text-label font-semibold text-foreground">
          {identity?.displayName ?? "CSRM user"}
        </p>
        {identity ? (
          <p className="truncate text-label text-muted-foreground" title={identity.email}>
            {identity.email}
          </p>
        ) : null}
      </div>
    </header>
  );
}
