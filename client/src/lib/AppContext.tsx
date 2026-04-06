import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'el';
type Theme = 'light' | 'dark';
type VoiceMode = 'idle' | 'listening' | 'speaking';

export interface CustomActionLocal {
  id: number;
  label: string;
  icon: string;
  target: string;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isMobile: boolean;
  t: (key: string) => string;
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;
  isOffline: boolean;
  customActions: CustomActionLocal[];
  setCustomActions: (actions: CustomActionLocal[]) => void;
}

const translations: Record<string, Record<string, string>> = {
  en: {
    'new_chat': 'New chat',
    'search': 'Search & Ask',
    'today': 'Today',
    'previous_7_days': 'Previous 7 Days',
    'previous_30_days': 'Previous 30 Days',
    'pinned': 'Pinned',
    'folders': 'Folders',
    'settings': 'Settings',
    'workspace': 'Workspace',
    'integrations': 'Integrations',
    'api_keys': 'API Keys',
    'type_message': 'Message DriveAI or / for commands...',
    'shortcuts': 'Shortcuts & Prompts',
    'knowledge_base': 'Knowledge Base',
    'users': 'Users & Roles',
    'pin': 'Pin',
    'delete': 'Delete',
    'model_select': 'Model',
    'add_key': 'Add Key',
    'save': 'Save',
    'cancel': 'Cancel',
    'general': 'General',
    'language': 'Language',
    'theme': 'Theme',
    'memory': 'Memory',
    'notifications': 'Notifications',
    'export': 'Export & Share',
    'admin': 'Admin Controls',
    'regenerate': 'Regenerate',
    'copy': 'Copy',
    'edit': 'Edit',
    'fleet': 'Fleet Ops',
    'washers': 'Washers Queue',
    'shifts': 'Shifts & Planning',
    'calendar': 'Master Calendar',
    'imports': 'Data Imports',
    'ops_inbox': 'Ops Inbox',
    'analytics': 'Analytics',
    'app_health': 'System Health',
    'kiosk_mode': 'Washer Kiosk',
    'digital_twin': 'Digital Twin',
    'automations': 'Automations',
    'war_room': 'War Room',
    'executive': 'Executive Intelligence',
    'vehicle_intel': 'Vehicle Intelligence',
    'workspace_memory': 'AI Memory',
    'trust_console': 'Trust & Compliance'
  },
  el: {
    'new_chat': 'Νέα συνομιλία',
    'search': 'Αναζήτηση & Ερωτήσεις',
    'today': 'Σήμερα',
    'previous_7_days': 'Προηγούμενες 7 Ημέρες',
    'previous_30_days': 'Προηγούμενες 30 Ημέρες',
    'pinned': 'Καρφιτσωμένα',
    'folders': 'Φάκελοι',
    'settings': 'Ρυθμίσεις',
    'workspace': 'Χώρος Εργασίας',
    'integrations': 'Ενσωματώσεις',
    'api_keys': 'Κλειδιά API',
    'type_message': 'Μήνυμα στο DriveAI ή / για εντολές...',
    'shortcuts': 'Συντομεύσεις & Προτροπές',
    'knowledge_base': 'Βάση Γνώσεων',
    'users': 'Χρήστες & Ρόλοι',
    'pin': 'Καρφίτσωμα',
    'delete': 'Διαγραφή',
    'model_select': 'Μοντέλο',
    'add_key': 'Προσθήκη Κλειδιού',
    'save': 'Αποθήκευση',
    'cancel': 'Ακύρωση',
    'general': 'Γενικά',
    'language': 'Γλώσσα',
    'theme': 'Θέμα',
    'memory': 'Μνήμη',
    'notifications': 'Ειδοποιήσεις',
    'export': 'Εξαγωγή & Κοινοποίηση',
    'admin': 'Έλεγχοι Διαχειριστή',
    'regenerate': 'Αναδημιουργία',
    'copy': 'Αντιγραφή',
    'edit': 'Επεξεργασία',
    'fleet': 'Στόλος',
    'washers': 'Ουρά Πλυντηρίων',
    'shifts': 'Βάρδιες & Προγραμματισμός',
    'calendar': 'Ημερολόγιο',
    'imports': 'Εισαγωγές Δεδομένων',
    'ops_inbox': 'Εισερχόμενα Λειτουργιών',
    'analytics': 'Αναλύσεις',
    'app_health': 'Υγεία Συστήματος',
    'kiosk_mode': 'Λειτουργία Kiosk',
    'digital_twin': 'Ψηφιακό Δίδυμο',
    'automations': 'Αυτοματισμοί',
    'war_room': 'Αίθουσα Πολέμου',
    'executive': 'Εκτελεστική Νοημοσύνη',
    'vehicle_intel': 'Νοημοσύνη Οχημάτων',
    'workspace_memory': 'Μνήμη AI',
    'trust_console': 'Εμπιστοσύνη & Συμμόρφωση'
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle');
  const [isOffline, setIsOffline] = useState(false);
  const [customActions, setCustomActions] = useState<CustomActionLocal[]>([]);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as Theme) || "dark"; 
    setTheme(savedTheme);
    const savedLang = (localStorage.getItem("language") as Language) || 'en';
    setLanguage(savedLang);
    if (savedTheme === 'dark') document.documentElement.classList.add("dark");

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setSidebarOpen(window.innerWidth >= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const setLanguageAndSave = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string) => {
    // eslint-disable-next-line security/detect-object-injection -- language is a controlled Language type; translations is a static hardcoded object
    return translations[language]?.[key] || key;
  };

  return (
    <AppContext.Provider value={{
      language,
      setLanguage: setLanguageAndSave,
      theme,
      toggleTheme,
      sidebarOpen,
      setSidebarOpen,
      isMobile,
      t,
      voiceMode,
      setVoiceMode,
      isOffline,
      customActions,
      setCustomActions,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
}
