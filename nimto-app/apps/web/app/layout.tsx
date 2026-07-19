import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { AdminFrame } from "./admin-frame";
import { UserFrame } from "./user-workspace";
import "./globals.css";
import { PwaRegistration } from "./pwa-registration";

export const metadata: Metadata = {
  title: "myNimto | Digital Invitations",
  description: "Create, share, and manage beautiful digital invitations.",
  applicationName: "myNimto",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "myNimto",
  },
  icons: {
    apple: "/pwa/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#8127d8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AdminFrame>
          <UserFrame>{children}</UserFrame>
        </AdminFrame>
        <SpeedInsights />
        <Analytics />
        <PwaRegistration />
      </body>
    </html>
  );
}
