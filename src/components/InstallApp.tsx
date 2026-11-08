'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'dot-install-prompt-dismissed-until';
const EVENT_END = '2026-12-12';

/** Invitation d'installation discrète, proposée une seule fois par période et uniquement avant la cérémonie. */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setInstalled(standalone);
    setIos(isAppleMobile);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setPrompt(null);
      setHelp(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const now = new Date();
    const ceremonyEnd = new Date(`${EVENT_END}T23:59:59`);
    let dismissedUntil = 0;
    try {
      dismissedUntil = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    } catch {}
    if (!standalone && now <= ceremonyEnd && Date.now() > dismissedUntil) {
      const timer = window.setTimeout(() => setVisible(true), 8_000);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    setHelp(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {}
  }

  async function install() {
    if (!prompt) {
      setHelp(true);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice.catch(() => undefined);
    } catch {
      // Si le navigateur refuse le prompt, le visiteur pourra réessayer plus tard.
    } finally {
      setPrompt(null);
      dismiss();
    }
  }

  if (installed || !visible) return null;

  return (
    <div className="install-overlay" role="presentation" onClick={event => {
      if (event.target === event.currentTarget) dismiss();
    }}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button type="button" className="install-close" onClick={dismiss} aria-label="Fermer"><X size={20} /></button>
        <div className="install-icon"><Smartphone size={25} /></div>
        <h2 id="install-title">Gardez notre invitation sur votre téléphone</h2>
        <p>Retrouvez facilement le programme et les informations de notre célébration.</p>
        {!help ? (
          <>
            <p className="install-note">L’installation est facultative et gratuite. Vous pourrez supprimer l’application après la célébration.</p>
            <div className="install-actions">
              <button type="button" className="button" onClick={() => void install()}>Installer maintenant</button>
              <button type="button" className="button secondary" onClick={dismiss}>Plus tard</button>
            </div>
          </>
        ) : (
          <div className="install-help" role="region" aria-label="Instructions d'installation">
            {ios ? (
              <ol>
                <li>Ouvrez ce site dans Safari.</li>
                <li>Touchez le bouton <strong>Partager</strong>.</li>
                <li>Choisissez <strong>« Sur l’écran d’accueil »</strong>, puis <strong>Ajouter</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Ouvrez le menu de votre navigateur (les trois points ⋮).</li>
                <li>Choisissez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.</li>
                <li>Confirmez l’installation.</li>
              </ol>
            )}
            <button type="button" className="button secondary" onClick={dismiss}>J’ai compris</button>
          </div>
        )}
      </section>
    </div>
  );
}
