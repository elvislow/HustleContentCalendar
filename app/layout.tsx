import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import './globals.css';

const urbanist = Urbanist({
  variable: '--font-urbanist',
  subsets: ['latin'],
  display: 'swap',
});

const siteOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'Content Flow — Multi-brand Content Calendar',
  description: 'Plan content for hustle. and The Second Studio, track production, attach published posts, and measure engagement.',
  openGraph: {
    title: 'Content Flow — Multi-brand Content Calendar',
    description: 'Plan. Create. Grow. — hustle. × The Second Studio',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'Content Flow — hustle. and The Second Studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Content Flow — Multi-brand Content Calendar',
    description: 'Plan. Create. Grow. — hustle. × The Second Studio',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${urbanist.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
