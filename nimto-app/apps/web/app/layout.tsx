import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { AdminFrame } from "./admin-frame";
import { UserFrame } from "./user-workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nimto | Digital Invitations",
  description: "Create, share, and manage beautiful digital invitations.",
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
      </body>
    </html>
  );
}
