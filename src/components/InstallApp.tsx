'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** Bouton discret « Installer sur mon téléphone », avec des consignes simples quand le navigateur n'a pas de bouton d'installation. */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!prompt) {
      setHelp(open => !open);
      return;
    }
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
    setPrompt(null);
  }

  return (
    <>
      <button type="button" className="hero-link hero-link-button" onClick={() => void install()} aria-expanded={help}>
        <Smartphone size={17} /> Installer sur mon téléphone
      </button>
      {help && (
        <div className="install-help" role="region" aria-label="Comment installer le site sur votre téléphone">
          <button type="button" className="install-close" onClick={() => setHelp(false)} aria-label="Fermer"><X size={18} /></button>
          <b>Gardez le programme sur votre téléphone</b>
          {ios ? (
            <ol>
              <li>Ouvrez ce site dans <strong>Safari</strong> (pas dans WhatsApp ni Facebook).</li>
              <li>Touchez le bouton <strong>Partager</strong> (un carré avec une flèche vers le haut).</li>
              <li>Choisissez <strong>« Sur l’écran d’accueil »</strong>, puis touchez <strong>Ajouter</strong>.</li>
            </ol>
          ) : (
            <ol>
              <li>Ouvrez le menu de votre navigateur (les trois points <strong>⋮</strong>).</li>
              <li>Touchez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.</li>
              <li>Confirmez : l’icône <strong>Dot</strong> apparaît sur votre téléphone.</li>
            </ol>
          )}
        </div>
      )}
    </>
  );
}
