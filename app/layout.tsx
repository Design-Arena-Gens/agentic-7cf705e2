import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ClientProviders from '@/components/providers/ClientProviders';
import type { Viewport } from 'next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'InstantTempMail — One-Tap Disposable Inboxes',
  description:
    'Generate disposable inboxes instantly, monitor emails in real time, and stay safe with AI-powered summaries and phishing detection.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: '/icons/icon-192.png',
    apple: '/icons/icon-192.png'
  }
};

export const viewport: Viewport = {
  themeColor: '#5B4BFF'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-slate-100">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
