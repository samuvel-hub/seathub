import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SeatingProvider } from '@/context/SeatingContext';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Church Seating Management | Usher Pro',
  description: 'Live seating management application for church ushers and administrators',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <SeatingProvider>
            <Navbar />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
                {children}
              </main>
            </div>
          </SeatingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
