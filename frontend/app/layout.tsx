import type { Metadata } from "next";
import { fraunces, ibmPlexSans, ibmPlexMono } from "../fonts";
import { ThemeProvider } from "../components/ThemeProvider";
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans bg-void text-ink relative z-0">
        <ThemeProvider attribute="class" defaultTheme="dark">
          <div className="bg-galaxy"></div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
