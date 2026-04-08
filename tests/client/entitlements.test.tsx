import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { parseEntitlementError } from "@/lib/queryClient";

// ---------- parseEntitlementError ----------

describe("parseEntitlementError", () => {
  it("returns feature key from valid entitlement 403 error", () => {
    const err = new Error(
      '403: {"message":"Feature not enabled","code":"ENTITLEMENT_REQUIRED","feature":"exports"}'
    );
    expect(parseEntitlementError(err)).toBe("exports");
  });

  it("returns null for non-403 error", () => {
    expect(parseEntitlementError(new Error("500: Internal"))).toBeNull();
  });

  it("returns null for 403 without ENTITLEMENT_REQUIRED code", () => {
    expect(
      parseEntitlementError(new Error('403: {"message":"Forbidden"}'))
    ).toBeNull();
  });

  it("returns null for non-Error values", () => {
    expect(parseEntitlementError("string")).toBeNull();
    expect(parseEntitlementError(null)).toBeNull();
    expect(parseEntitlementError(undefined)).toBeNull();
  });

  it("returns null for malformed JSON body", () => {
    expect(parseEntitlementError(new Error("403: not json"))).toBeNull();
  });
});

// ---------- LockedFeature component ----------

// We need TooltipProvider from Radix for Tooltip to render.
// Mock the tooltip chain to avoid Radix portal complexity in jsdom.
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

import { LockedFeature, LockedSection } from "@/components/LockedFeature";

describe("LockedFeature", () => {
  it("renders children normally when not locked", () => {
    render(
      <LockedFeature locked={false}>
        <button>Export</button>
      </LockedFeature>
    );
    const btn = screen.getByRole("button", { name: "Export" });
    expect(btn).toBeInTheDocument();
    // No lock icon
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  it("renders children with lock overlay when locked", () => {
    render(
      <LockedFeature locked={true}>
        <button>Export</button>
      </LockedFeature>
    );
    const btn = screen.getByRole("button", { name: "Export" });
    expect(btn).toBeInTheDocument();
    // The button wrapper should have pointer-events-none
    expect(btn.closest(".pointer-events-none")).toBeTruthy();
  });

  it("shows custom message in tooltip when locked", () => {
    render(
      <LockedFeature locked={true} message="Upgrade required">
        <button>Export</button>
      </LockedFeature>
    );
    expect(screen.getByText("Upgrade required")).toBeInTheDocument();
  });
});

// ---------- LockedSection component ----------

describe("LockedSection", () => {
  it("renders the feature name and premium badge", () => {
    render(
      <LockedSection
        feature="exports"
        title="Export Reports"
        description="CSV and PDF exports are not enabled."
      />
    );
    expect(screen.getByText("Export Reports")).toBeInTheDocument();
    expect(
      screen.getByText("CSV and PDF exports are not enabled.")
    ).toBeInTheDocument();
    expect(screen.getByText("Premium Feature")).toBeInTheDocument();
    expect(screen.getByTestId("locked-exports")).toBeInTheDocument();
  });

  it("renders default description when none provided", () => {
    render(<LockedSection feature="kpi_snapshots" title="KPI Snapshots" />);
    expect(
      screen.getByText(/not enabled for your workspace/)
    ).toBeInTheDocument();
  });
});

// ---------- useEntitlements hook ----------

// Mock dependencies to test the hook shape
vi.mock("@/lib/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, role: "admin" } }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: any) => {
      if (queryKey[0] === "/api/entitlements/features") {
        return {
          data: {
            plan: "professional",
            features: {
              exports: true,
              advanced_exports: false,
              automation_execution: true,
              kpi_snapshots: false,
            },
          },
          isLoading: false,
          error: null,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    },
  };
});

import { useEntitlements } from "@/lib/useEntitlements";

// Small test component to render hook results
function HookConsumer() {
  const { plan, hasFeature } = useEntitlements();
  return (
    <div>
      <span data-testid="plan">{plan}</span>
      <span data-testid="exports">{String(hasFeature("exports"))}</span>
      <span data-testid="advanced_exports">
        {String(hasFeature("advanced_exports"))}
      </span>
      <span data-testid="kpi_snapshots">
        {String(hasFeature("kpi_snapshots"))}
      </span>
      <span data-testid="automation_execution">
        {String(hasFeature("automation_execution"))}
      </span>
    </div>
  );
}

describe("useEntitlements", () => {
  it("returns plan and resolves feature flags", () => {
    render(<HookConsumer />);
    expect(screen.getByTestId("plan").textContent).toBe("professional");
    expect(screen.getByTestId("exports").textContent).toBe("true");
    expect(screen.getByTestId("advanced_exports").textContent).toBe("false");
    expect(screen.getByTestId("kpi_snapshots").textContent).toBe("false");
    expect(screen.getByTestId("automation_execution").textContent).toBe(
      "true"
    );
  });
});
