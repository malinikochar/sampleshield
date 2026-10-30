import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SampleShield — Specimen Chain-of-Custody',
    short_name: 'SampleShield',
    description:
      'Accountable chain-of-custody tracking, offline handover queue, and human-reviewed laboratory exceptions for diagnostic specimens.',
    start_url: '/app/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F7FAFC',
    theme_color: '#0E9488',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
