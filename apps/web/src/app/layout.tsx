import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SimpleSign',
  description: 'Upload documents and share signing links instantly',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
