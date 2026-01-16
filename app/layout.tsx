import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ZiaProvider } from './ui/context/ZiaProvider';
import NavBar from './ui/NavBar';

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
          <NavBar />
          {children}
          <footer className="h-16 bg-gray-100 dark:bg-gray-800 p-5 text-center">
            Zia app
          </footer>
        </ZiaProvider>
      </body>
    </html>
  );
}
