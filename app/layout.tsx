import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Auth from './ui/Auth';
import { ZiaProvider } from './ui/context/ZiaProvider';
import BackendMismatchBanner from './ui/BackendMismatchBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ZIA Personal AI assistant',
  description: 'AI assistant to store and analyze personal data',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen flex flex-col ${inter.className}`}>
        <ZiaProvider>
          <header className="p-5">
            <div className="max-w-[20cm] w-full mx-auto">
              <BackendMismatchBanner />
            </div>
            <Auth />
          </header>
          {children}
          <footer className="h-16 bg-gray-100 dark:bg-gray-800 p-5 text-center">
            Zia app
          </footer>
        </ZiaProvider>
      </body>
    </html>
  );
}
