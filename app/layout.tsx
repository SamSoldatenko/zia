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
        <body className={`min-h-screen flex flex-col ${inter.className}`}>
          <header className="h-16 justify-between p-5">
            <Auth />
          </header>
          {children}
          <footer className="h-16 bg-gray-100 p-5 text-center">
            Zia app
          </footer>
        </body>
      </html>
    </ZiaProvider>
  );
}
