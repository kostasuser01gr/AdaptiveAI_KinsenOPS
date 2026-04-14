import { useMemo } from 'react';

export type Platform = 'web' | 'pwa' | 'electron' | 'capacitor';

interface PlatformInfo {
  platform: Platform;
  isDesktop: boolean;
  isMobile: boolean;
  isNative: boolean;
  isPWA: boolean;
  isElectron: boolean;
  isCapacitor: boolean;
  os: 'mac' | 'windows' | 'linux' | 'ios' | 'android' | 'unknown';
}

function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent.toLowerCase();

  // Electron detection
  const isElectron = !!(window as any).electronAPI?.isElectron;

  // Capacitor detection
  const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();

  // PWA detection (installed or standalone)
  const isPWA = !isElectron && !isCapacitor && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );

  // OS detection
  let os: PlatformInfo['os'] = 'unknown';
  if (isElectron) {
    const ep = (window as any).electronAPI?.platform || '';
    if (ep === 'darwin') os = 'mac';
    else if (ep === 'win32') os = 'windows';
    else if (ep === 'linux') os = 'linux';
  } else if (/iphone|ipad|ipod/.test(ua)) {
    os = 'ios';
  } else if (/android/.test(ua)) {
    os = 'android';
  } else if (/macintosh/.test(ua)) {
    os = 'mac';
  } else if (/windows/.test(ua)) {
    os = 'windows';
  } else if (/linux/.test(ua)) {
    os = 'linux';
  }

  const isMobile = os === 'ios' || os === 'android';
  const isDesktop = !isMobile;

  let platform: Platform = 'web';
  if (isElectron) platform = 'electron';
  else if (isCapacitor) platform = 'capacitor';
  else if (isPWA) platform = 'pwa';

  return { platform, isDesktop, isMobile, isNative: isElectron || isCapacitor, isPWA, isElectron, isCapacitor, os };
}

let cached: PlatformInfo | null = null;

export function usePlatform(): PlatformInfo {
  return useMemo(() => {
    if (!cached) cached = detectPlatform();
    return cached;
  }, []);
}
