import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "areyougoingslop",
  description:
    "A playful, transparent heuristic for how AI-assisted a GitHub user's public contributions look.",
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
