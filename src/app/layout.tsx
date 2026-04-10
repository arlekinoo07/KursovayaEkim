import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArleAI Chat",
  description: "Chat interface on Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
