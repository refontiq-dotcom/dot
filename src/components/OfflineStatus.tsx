'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Indique clairement quand le visiteur consulte la copie locale du site. */
export default function OfflineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="offline-status" role="status" aria-live="polite">
      <WifiOff size={17} aria-hidden="true" />
      <span><strong>Mode hors connexion.</strong> Les informations déjà chargées restent consultables. Les inscriptions et modifications nécessitent Internet.</span>
    </div>
  );
}
