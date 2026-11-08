import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Dot',
    short_name: 'Dot',
    description: 'Le programme et les informations pratiques de la dot, sur votre téléphone.',
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fdfbf7',
    theme_color: '#0b2f73',
    categories: ['lifestyle'],
    icons: [
      { src: '/couple-frederic-vanessa.jpg', sizes: '1000x1000', type: 'image/jpeg', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Programme de la journée', short_name: 'Programme', url: '/#programme', icons: [{ src: '/couple-frederic-vanessa.jpg', sizes: '1000x1000', type: 'image/jpeg' }] },
      { name: 'Confirmer ma présence', short_name: 'Présence', url: '/#rsvp', icons: [{ src: '/couple-frederic-vanessa.jpg', sizes: '1000x1000', type: 'image/jpeg' }] },
    ],
  };
}
