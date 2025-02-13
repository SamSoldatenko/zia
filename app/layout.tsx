import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZIA Personal AI assistant",
  description: "AI assistant to store and analyze personal data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="flex flex-col items-center justify-between p-5">
          <div>Test header</div>
        </header>
        {children}
      </body>
    </html>
  );
}
