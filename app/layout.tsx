import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "International Soccer Rankings",
  description:
    "Data-driven international soccer rankings powered by 12 backtested models (Elo, Glicko-2, Bradley-Terry, and more), optimized against betting market odds. Includes Dixon-Coles match predictions and 100K-iteration Monte Carlo World Cup 2026 simulations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <Navbar />
          <main className="container mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
