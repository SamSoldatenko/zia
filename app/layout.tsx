import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Auth from "./ui/Auth";
import { ZiaProvider } from "./ui/ZiaContext";

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
    <ZiaProvider>
      <html lang="en">
        <body className={inter.className}>
          <header className="flex flex-col items-center justify-between p-5">
            <div>Test header</div>
            <Auth />
          </header>
          {children}
        </body>
      </html>
    </ZiaProvider>
  );
}
