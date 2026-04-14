import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import translations from './i18n';
import type { Language } from './i18n';

type Theme = 'light' | 'dark' | 'midnight' | 'sunset' | 'ocean' | 'forest';
type VoiceMode = 'idle' | 'listening' | 'speaking';

export interface CustomActionLocal {
  id: number;
  label: string;
  icon: string;
  target: string;
}

// ─── UI Context: layout, responsiveness, connectivity ─────────────────────
interface UIContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isMobile: boolean;
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;
  isOffline: boolean;
  customActions: CustomActionLocal[];
  setCustomActions: (actions: CustomActionLocal[]) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

// ─── Prefs Context: theme, language, notifications ────────────────────────
interface PrefsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
  notificationSoundEnabled: boolean;
  setNotificationSoundEnabled: (enabled: boolean) => void;
  notificationVolume: number;
  setNotificationVolume: (volume: number) => void;
}

const PrefsContext = createContext<PrefsContextType | undefined>(undefined);

// ─── Combined type (backward compat) ─────────────────────────────────────
interface AppContextType extends UIContextType, PrefsContextType {}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle');
  const [isOffline, setIsOffline] = useState(false);
  const [customActions, setCustomActions] = useState<CustomActionLocal[]>([]);

  // Prefs state
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(() => {
    return localStorage.getItem("notif_sound") !== "false";
  });
  const [notificationVolume, setNotificationVolume] = useState(() => {
    return parseFloat(localStorage.getItem("notif_volume") || "0.5");
  });

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as Theme) || "dark"; 
    setThemeState(savedTheme);
    const savedLang = (localStorage.getItem("language") as Language) || 'en';
    setLanguage(savedLang);
    const savedCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
    setSidebarCollapsed(savedCollapsed);
    applyThemeClass(savedTheme);

    const mql = window.matchMedia('(max-width: 767px)');
    const checkMobile = (matches: boolean) => {
      setIsMobile(matches);
      setSidebarOpen(!matches);
    };
    checkMobile(mql.matches);
    const onMqlChange = (e: MediaQueryListEvent) => checkMobile(e.matches);
    mql.addEventListener('change', onMqlChange);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mql.removeEventListener('change', onMqlChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyThemeClass = (t: Theme) => {
    const el = document.documentElement;
    el.classList.remove("dark", "midnight", "sunset", "ocean", "forest");
    if (t !== "light") el.classList.add(t === "dark" ? "dark" : t);
    // All custom themes build on the dark base
    if (["midnight", "sunset", "ocean", "forest"].includes(t)) el.classList.add("dark");
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    applyThemeClass(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const handleSetSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  };

  const handleSetNotifSound = (enabled: boolean) => {
    setNotificationSoundEnabled(enabled);
    localStorage.setItem("notif_sound", String(enabled));
  };

  const handleSetNotifVolume = (volume: number) => {
    setNotificationVolume(volume);
    localStorage.setItem("notif_volume", String(volume));
  };

  const setLanguageAndSave = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string) => {
    // eslint-disable-next-line security/detect-object-injection -- language is a controlled Language type; translations is a static hardcoded object
    return translations[language]?.[key] || key;
  };

  const uiValue = useMemo<UIContextType>(() => ({
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed: handleSetSidebarCollapsed,
    isMobile,
    voiceMode,
    setVoiceMode,
    isOffline,
    customActions,
    setCustomActions,
  }), [sidebarOpen, sidebarCollapsed, isMobile, voiceMode, isOffline, customActions]);

  const prefsValue = useMemo<PrefsContextType>(() => ({
    language,
    setLanguage: setLanguageAndSave,
    theme,
    setTheme,
    toggleTheme,
    t,
    notificationSoundEnabled,
    setNotificationSoundEnabled: handleSetNotifSound,
    notificationVolume,
    setNotificationVolume: handleSetNotifVolume,
  }), [language, theme, notificationSoundEnabled, notificationVolume]);

  return (
    <UIContext.Provider value={uiValue}>
      <PrefsContext.Provider value={prefsValue}>
        {children}
      </PrefsContext.Provider>
    </UIContext.Provider>
  );
}

/** Focused hook: layout, sidebar, mobile, connectivity, voice, custom actions */
export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) throw new Error('useUI must be used within an AppProvider');
  return context;
}

/** Focused hook: theme, language, translations, notification prefs */
export function usePrefs() {
  const context = useContext(PrefsContext);
  if (context === undefined) throw new Error('usePrefs must be used within an AppProvider');
  return context;
}

/** Backward-compatible hook — reads both contexts. Prefer useUI() or usePrefs() for fewer re-renders. */
export function useApp(): AppContextType {
  const ui = useContext(UIContext);
  const prefs = useContext(PrefsContext);
  if (ui === undefined || prefs === undefined) throw new Error('useApp must be used within an AppProvider');
  return { ...ui, ...prefs };
}
