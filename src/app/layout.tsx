
import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
