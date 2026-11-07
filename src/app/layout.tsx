import type { Metadata, Viewport } from 'next';
import PwaRegister from '@/components/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deux peuples pour une union sacrée — Anougbre Brou Frédéric & Dukoua You Vanessa',
  description: 'Toutes les informations pratiques pour célébrer la dot traditionnelle d’Anougbre Brou Frédéric et Dukoua You Vanessa, le 12 décembre 2026 à Cocody Angré.',
  applicationName: 'Dot',
  appleWebApp: { capable: true, title: 'Dot', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2f73',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
