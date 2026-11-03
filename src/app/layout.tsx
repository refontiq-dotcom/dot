import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Deux héritages, une même union — Anougbre & Dukoua', description: 'Toutes les informations pratiques pour célébrer l’union traditionnelle d’Anougbre Frédéric et Dukoua You Vanessa, le 12 décembre 2026 à Cocody Angré.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }
