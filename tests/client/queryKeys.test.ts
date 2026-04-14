import { describe, it, expect } from "vitest";
import { buildQueryPath } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

describe("queryKeys", () => {
  it("builds stable nested resource paths", () => {
    expect(buildQueryPath(queryKeys.tabs.widgets(42))).toBe("/api/tabs/42/widgets");
    expect(buildQueryPath(queryKeys.vehicles.evidence(7))).toBe("/api/vehicles/7/evidence");
  });

  it("omits nullish key segments when building a path", () => {
    expect(buildQueryPath(queryKeys.tabs.widgets(null))).toBe("/api/tabs/widgets");
    expect(buildQueryPath(queryKeys.vehicles.timeline(undefined))).toBe("/api/vehicles/timeline");
  });

  it("encodes query-string based keys consistently", () => {
    expect(queryKeys.activity.feed(15)).toEqual(["/api/activity-feed?limit=15"]);
    expect(queryKeys.incidents.byStatuses("open", "investigating")).toEqual([
      "/api/incidents?status=open&status=investigating",
    ]);
    expect(queryKeys.widgets.catalog("fleet ops")).toEqual([
      "/api/widgets/catalog?category=fleet+ops",
    ]);
  });
});