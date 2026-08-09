/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoadingPage from "@/app/loading";
import NotFoundPage from "@/app/not-found";
import { routeDefinitions } from "@/config/routes";
import type { IdentitySnapshot } from "@/domain/identity";

import { AppShell } from "./app-shell";
import { MobileNavigation } from "./mobile-navigation";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/ui/tooltip", async () => {
  const React = await import("react");

  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
    TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

vi.mock("@/components/ui/sheet", async () => {
  const React = await import("react");
  const SheetContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
  } | null>(null);

  function Sheet({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) {
    React.useEffect(() => {
      const dismiss = (event: KeyboardEvent) => {
        if (event.key === "Escape") onOpenChange(false);
      };
      document.addEventListener("keydown", dismiss);
      return () => document.removeEventListener("keydown", dismiss);
    }, [onOpenChange]);

    return (
      <SheetContext.Provider value={{ open, setOpen: onOpenChange }}>
        {children}
      </SheetContext.Provider>
    );
  }

  return {
    Sheet,
    SheetTrigger: ({
      children,
    }: {
      children: React.ReactElement<{ onClick?: () => void }>;
    }) => {
      const context = React.useContext(SheetContext);
      return React.cloneElement(children, { onClick: () => context?.setOpen(true) });
    },
    SheetContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      const context = React.useContext(SheetContext);
      return context?.open ? <div role="dialog" {...props}>{children}</div> : null;
    },
    SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

const requestor: IdentitySnapshot = {
  fixtureKey: "requestor",
  subject: "fixture:jane.doe@idambox.com",
  displayName: "Requestor — Jane",
  email: "jane.doe@idambox.com",
  capabilities: ["function.dashboard.dashboard"],
};

const analyst: IdentitySnapshot = {
  ...requestor,
  fixtureKey: "analyst",
  subject: "fixture:bob.doe@idambox.com",
  displayName: "Security Analyst — Bob",
  email: "bob.doe@idambox.com",
  capabilities: [
    "function.dashboard.dashboard",
    "function.administration.controls",
  ],
};

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

function renderShell(identity: IdentitySnapshot = requestor) {
  return render(
    <AppShell identity={identity} routes={routeDefinitions}>
      <h1>Cyber Risk Manager</h1>
      <p>Your cyber risk management workspace is ready.</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("renders the desktop foundation shell with ordered landmarks and one page title", () => {
    const { container } = renderShell();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const header = screen.getByRole("banner");
    const navigation = screen.getByRole("navigation", { name: "CSRM navigation" });
    const main = screen.getByRole("main");

    const landmarks: readonly Element[] = [skipLink, header, navigation, main];

    expect(landmarks).toEqual(
      [...container.querySelectorAll("a, header, nav, main")].filter((node) =>
        landmarks.includes(node),
      ),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(main.id).toBe("main-content");
    expect(main.className).toContain("lg:pl-[272px]");
    expect(main.className).toContain("lg:pt-16");
    expect(main.querySelector(".max-w-canvas")).not.toBeNull();
    expect(header.className).toContain("lg:pl-[272px]");
  });

  it("filters planned navigation for both requestor and analyst identities", () => {
    const { rerender } = renderShell();

    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toContain("border-l-[3px]");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toContain("bg-primary-soft");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toContain("font-semibold");
    expect(screen.queryByText("Risk Assessment Requests")).toBeNull();
    expect(screen.queryByText("Administration")).toBeNull();
    expect(screen.queryByRole("link", { name: "Controls" })).toBeNull();

    rerender(
      <AppShell identity={analyst} routes={routeDefinitions}>
        <h1>Cyber Risk Manager</h1>
      </AppShell>,
    );

    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(1);
    expect(screen.queryByText("Administration")).toBeNull();
    expect(screen.queryByRole("link", { name: "Controls" })).toBeNull();
  });

  it("keeps loading geometry stable and renders planned routes as the shared unavailable state", () => {
    const { rerender } = render(<LoadingPage />);

    expect(screen.getByRole("status", { name: "Loading page" })).toBeDefined();
    expect(screen.getAllByTestId("loading-skeleton")).toHaveLength(3);
    expect(
      document.querySelectorAll('[data-slot="skeleton"][aria-hidden="true"]'),
    ).toHaveLength(3);

    rerender(<NotFoundPage />);
    expect(
      screen.getByRole("heading", { name: "This area isn’t available yet" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Go to CSRM home" })).toBeDefined();
    expect(screen.queryByText(/assessment request|backend|http/i)).toBeNull();
  });

  it("guards the analyst-only evidence route before protected work", async () => {
    const { default: RequestorEvidencePage } = await import(
      "@/app/test-evidence/analyst-only/page"
    );

    render(await RequestorEvidencePage());
    expect(
      screen.getByRole("heading", { name: "You don’t have access to this area" }),
    ).toBeDefined();

    cleanup();
    vi.resetModules();
    vi.doMock("@/lib/fixtures/resolve-identity", () => ({
      isFixtureRuntime: () => true,
      resolveDevelopmentIdentity: () => analyst,
    }));
    const { default: AnalystEvidencePage } = await import(
      "@/app/test-evidence/analyst-only/page"
    );

    render(await AnalystEvidencePage());
    expect(
      screen.getByRole("heading", { name: "Authorization evidence" }),
    ).toBeDefined();
    expect(screen.queryByText(/request|record|backend|http/i)).toBeNull();
    vi.doUnmock("@/lib/fixtures/resolve-identity");
  });

  it("makes the analyst-only evidence route unavailable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { default: AnalystOnlyEvidencePage } = await import(
      "@/app/test-evidence/analyst-only/page"
    );

    await expect(AnalystOnlyEvidencePage()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });

    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/fixtures/resolve-identity");
  });

  it("opens and dismisses mobile navigation with Escape, route selection, and focus restoration", async () => {
    const user = userEvent.setup();
    render(<MobileNavigation routes={[routeDefinitions[0]]} />);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "CSRM navigation" })).toBeDefined();
    expect(screen.getByRole("navigation", { name: "CSRM navigation" })).toBeDefined();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "CSRM navigation" })).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(screen.queryByRole("dialog", { name: "CSRM navigation" })).toBeNull();
  });

  it("persists only sidebar presentation", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<Sidebar routes={[routeDefinitions[0]]} />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(setItem).toHaveBeenCalledWith(
      "idambox-csrm-sidebar-collapsed",
      "true",
    );
    expect(setItem.mock.calls.flat().join(" ")).not.toMatch(
      /identity|capabilit|role|token/i,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeDefined();
  });

  it("collapses desktop navigation while coordinating shell offsets", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AppShell identity={requestor} routes={routeDefinitions}>
        <h1>Cyber Risk Manager</h1>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(screen.getByRole("complementary").className).toContain("lg:w-16");
    expect(container.querySelector("main")?.className).toContain(
      "lg:pl-[var(--csrm-sidebar-width,272px)]",
    );
    expect(screen.getByRole("banner").className).toContain(
      "lg:pl-[var(--csrm-sidebar-width,272px)]",
    );
  });
});
