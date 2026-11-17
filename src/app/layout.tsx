
import type { Metadata } from "next";
import "./globals.css";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";

export const metadata: Metadata = {
  title: "Rumrunners — A life of crime",
  description:
    "A browser-based underworld game set in Britain, 1933."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PresenceHeartbeat />
        {children}
      </body>
    </html>
  );
}
