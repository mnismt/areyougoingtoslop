import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "areyougoingslop",
  description:
    "A playful, transparent heuristic for how AI-assisted a GitHub user's public contributions look.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "areyougoingslop",
    description:
      "A playful, transparent heuristic for how AI-assisted a GitHub user's public contributions look.",
    images: ["/api/og/default"],
  },
  twitter: {
    card: "summary_large_image",
    title: "areyougoingslop",
    description:
      "A playful, transparent heuristic for how AI-assisted a GitHub user's public contributions look.",
    images: ["/api/og/default"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
