import type { Metadata, Viewport } from "next";
import { MiniPlayer } from "@/components/MiniPlayer";
import { PasscodeGate } from "@/components/PasscodeGate";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "City Tour",
  description: "Personal city tours planned by Claude, with maps and podcast-style audio guides.",
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "City Tour", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PasscodeGate>{children}</PasscodeGate>
        <MiniPlayer />
        <ServiceWorker />
      </body>
    </html>
  );
}
