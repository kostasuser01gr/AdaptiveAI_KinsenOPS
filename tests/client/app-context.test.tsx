import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { AppProvider, useApp, useUI, usePrefs } from "@/lib/AppContext";

// Mock matchMedia for the component
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe("useUI — focused UI context", () => {
  it("provides sidebar state", () => {
    const { result } = renderHook(() => useUI(), { wrapper });
    expect(result.current.sidebarOpen).toBe(true);
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(typeof result.current.setSidebarOpen).toBe("function");
  });

  it("provides mobile + offline state", () => {
    const { result } = renderHook(() => useUI(), { wrapper });
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isOffline).toBe(false);
  });

  it("provides voice mode", () => {
    const { result } = renderHook(() => useUI(), { wrapper });
    expect(result.current.voiceMode).toBe("idle");
    act(() => result.current.setVoiceMode("listening"));
    expect(result.current.voiceMode).toBe("listening");
  });

  it("provides custom actions", () => {
    const { result } = renderHook(() => useUI(), { wrapper });
    expect(result.current.customActions).toEqual([]);
  });

  it("throws outside provider", () => {
    expect(() => renderHook(() => useUI())).toThrow("useUI must be used within an AppProvider");
  });
});

describe("usePrefs — focused preferences context", () => {
  it("provides language + theme defaults", () => {
    const { result } = renderHook(() => usePrefs(), { wrapper });
    expect(result.current.language).toBe("en");
    expect(result.current.theme).toBe("dark");
    expect(typeof result.current.t).toBe("function");
  });

  it("provides notification prefs", () => {
    const { result } = renderHook(() => usePrefs(), { wrapper });
    expect(result.current.notificationSoundEnabled).toBe(true);
    expect(result.current.notificationVolume).toBe(0.5);
  });

  it("t() returns key when translation missing", () => {
    const { result } = renderHook(() => usePrefs(), { wrapper });
    expect(result.current.t("nonexistent_key")).toBe("nonexistent_key");
  });

  it("throws outside provider", () => {
    expect(() => renderHook(() => usePrefs())).toThrow("usePrefs must be used within an AppProvider");
  });
});

describe("useApp — backward-compatible combined hook", () => {
  it("provides both UI and Prefs properties", () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    // UI properties
    expect(result.current.sidebarOpen).toBe(true);
    expect(result.current.isOffline).toBe(false);
    // Prefs properties
    expect(result.current.theme).toBe("dark");
    expect(result.current.language).toBe("en");
    // Functions
    expect(typeof result.current.setSidebarOpen).toBe("function");
    expect(typeof result.current.setTheme).toBe("function");
    expect(typeof result.current.t).toBe("function");
  });

  it("throws outside provider", () => {
    expect(() => renderHook(() => useApp())).toThrow("useApp must be used within an AppProvider");
  });
});
