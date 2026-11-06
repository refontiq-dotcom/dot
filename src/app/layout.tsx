import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deux peuples pour une union sacrée — Anougbre Brou Frédéric & Dukoua You Vanessa',
  description: 'Toutes les informations pratiques pour célébrer la dot traditionnelle d’Anougbre Brou Frédéric et Dukoua You Vanessa, le 12 décembre 2026 à Cocody Angré.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
