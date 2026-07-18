import type { Metadata } from "next";
import { fraunces, ibmPlexSans, ibmPlexMono } from "../fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aperture — AI Image Generation Studio",
  description: "A distinctive monochrome, darkroom-inspired generative space. Expose prompts, log seeds, and develop contact sheets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-void text-ink relative z-0">
        <div className="bg-galaxy"></div>
        {children}
      </body>
    </html>
  );
}
