/**
 * Feature Flags — Lightweight runtime toggle system.
 *
 * Flags are defined with defaults here. In production, override via:
 *   - Environment variables: FF_<FLAG_NAME>=true|false
 *   - Admin API: POST /api/admin/feature-flags { flag, enabled }
 *
 * Client consumption: GET /api/feature-flags returns current flag states.
 */

export type FeatureFlagName =
  | "ai_chat"
  | "digital_twin"
  | "war_room"
  | "executive_intelligence"
  | "vehicle_intelligence"
  | "workspace_memory"
  | "app_builder"
  | "ideas_hub"
  | "god_mode"
  | "virtual_scrolling"
  | "motion_animations"
  | "pwa_install_prompt"
  | "import_csv"
  | "export_reports";

interface FeatureFlagDef {
  description: string;
  default: boolean;
}

const FLAG_DEFINITIONS: Record<FeatureFlagName, FeatureFlagDef> = {
  ai_chat:                 { description: "AI chat assistant", default: true },
  digital_twin:            { description: "Digital twin real-time dashboard", default: true },
  war_room:                { description: "Incident war room", default: true },
  executive_intelligence:  { description: "Executive intelligence dashboard", default: true },
  vehicle_intelligence:    { description: "Vehicle intelligence AI features", default: true },
  workspace_memory:        { description: "Workspace-level AI memory", default: true },
  app_builder:             { description: "Low-code app builder", default: true },
  ideas_hub:               { description: "Ideas hub / innovation board", default: true },
  god_mode:                { description: "God mode admin panel", default: false },
  virtual_scrolling:       { description: "Virtual scrolling for large tables", default: true },
  motion_animations:       { description: "Framer Motion page transitions", default: true },
  pwa_install_prompt:      { description: "PWA install banner", default: true },
  import_csv:              { description: "CSV import functionality", default: true },
  export_reports:          { description: "Report export", default: true },
};

// Runtime overrides (set via admin API, reset on deploy)
const overrides = new Map<FeatureFlagName, boolean>();

/**
 * Resolve a flag value: override → env var → default
 */
export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  // 1. Runtime override (admin toggle)
  if (overrides.has(flag)) {
    return overrides.get(flag)!;
  }

  // 2. Environment variable: FF_AI_CHAT=true
  const envKey = `FF_${flag.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    return envVal === "true" || envVal === "1";
  }

  // 3. Default
  return FLAG_DEFINITIONS[flag]?.default ?? false;
}

/** Set a runtime override (survives until process restart) */
export function setFeatureFlag(flag: FeatureFlagName, enabled: boolean): void {
  overrides.set(flag, enabled);
}

/** Clear a runtime override (falls back to env/default) */
export function clearFeatureFlag(flag: FeatureFlagName): void {
  overrides.delete(flag);
}

/** Get all flags with current resolved values */
export function getAllFeatureFlags(): Record<FeatureFlagName, { enabled: boolean; description: string }> {
  const result = {} as Record<FeatureFlagName, { enabled: boolean; description: string }>;
  for (const [flag, def] of Object.entries(FLAG_DEFINITIONS) as [FeatureFlagName, FeatureFlagDef][]) {
    result[flag] = {
      enabled: isFeatureEnabled(flag),
      description: def.description,
    };
  }
  return result;
}

/** List of all valid flag names */
export function getFeatureFlagNames(): FeatureFlagName[] {
  return Object.keys(FLAG_DEFINITIONS) as FeatureFlagName[];
}
