import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FollowNest | Every inquiry matters',
  description: 'A lightweight follow-up tracker for Bangladesh-based social sellers',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
