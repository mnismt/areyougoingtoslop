import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
