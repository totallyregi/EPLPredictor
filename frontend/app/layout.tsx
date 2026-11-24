import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700'] });

export const metadata: Metadata = {
  title: 'EPL Predictor — every Premier League match, predicted',
  description: 'Live Premier League scoreline predictions, win probabilities and season projections from a Dixon-Coles Poisson model.',
};

export const viewport: Viewport = { themeColor: '#05070c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
