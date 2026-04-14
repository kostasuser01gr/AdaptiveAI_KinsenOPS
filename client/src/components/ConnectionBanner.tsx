import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useUI } from '@/lib/AppContext';

export function ConnectionBanner() {
  const { isOffline } = useUI();
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  useEffect(() => {
    const handler = () => setSwUpdateAvailable(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  const handleUpdate = () => {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    });
  };

  if (swUpdateAvailable) {
    return (
      <div className="bg-primary/90 text-primary-foreground px-4 py-2 text-center text-xs flex items-center justify-center gap-2 shrink-0">
        <RefreshCw className="h-3.5 w-3.5" />
        <span>A new version is available.</span>
        <button onClick={handleUpdate} className="underline font-medium">Reload now</button>
      </div>
    );
  }

  if (!isOffline) return null;

  return (
    <div className="bg-yellow-600 text-white px-4 py-2 text-center text-xs flex items-center justify-center gap-2 shrink-0">
      <WifiOff className="h-3.5 w-3.5" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  );
}
