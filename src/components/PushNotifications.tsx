'use client';

import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';

type Props = { guestName: string; phone: string };

function decodeKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export default function PushNotifications({ guestName, phone }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(false);

  async function activate() {
    setBusy(true);
    setMessage('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Votre navigateur ne prend pas en charge les notifications. Essayez Chrome ou Safari récent.');
      }
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIos && !standalone) {
        throw new Error('Sur iPhone, ajoutez d’abord ce site à l’écran d’accueil, ouvrez-le depuis son icône, puis revenez ici.');
      }
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Autorisez les notifications dans les réglages de votre navigateur pour recevoir les rappels.');

      const registration = await navigator.serviceWorker.ready;
      const keyResponse = await fetch('/api/push/subscribe', { cache: 'no-store' });
      const keyResult = await keyResponse.json();
      if (!keyResponse.ok || typeof keyResult.publicKey !== 'string') throw new Error(keyResult.error || 'Service de notification indisponible.');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(keyResult.publicKey),
        });
      }
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName, phone, subscription: subscription.toJSON() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossible d’activer les notifications.');
      setEnabled(true);
      setMessage('C’est activé ! Vous recevrez les rappels importants sur ce téléphone.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation impossible. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  if (enabled) return <div className="push-optin push-optin-success" role="status"><BellRing size={19}/><span>{message}</span></div>;
  return (
    <section className="push-optin" aria-label="Notifications de la cérémonie">
      <div><Bell size={20}/><div><strong>Recevoir les rappels sur mon téléphone</strong><p>Un rappel pour le pagne et les informations importantes de la cérémonie.</p></div></div>
      <button type="button" className="button secondary small" onClick={() => void activate()} disabled={busy}>{busy ? 'Activation…' : 'Activer les notifications'}</button>
      {message && <p className="push-optin-message" role="status">{message}</p>}
    </section>
  );
}
