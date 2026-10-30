import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'SampleShield — Accountable Specimen Chain-of-Custody',
    template: '%s · SampleShield',
  },
  description:
    'Every sample has a journey. Every handoff should be accountable. Offline-capable specimen chain-of-custody visibility between collection clinics, couriers, and receiving laboratories.',
  applicationName: 'SampleShield',
  appleWebApp: {
    capable: true,
    title: 'SampleShield',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E9488',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased selection:bg-[#0E9488]/20 selection:text-[#142437]">
        {children}
      </body>
    </html>
  );
}
