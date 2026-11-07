'use client';

import { useEffect } from 'react';

/** Enregistre le service worker (uniquement en production) pour l'installation et l'usage sans réseau. */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
        console.error('Dot : service worker indisponible.', error);
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
