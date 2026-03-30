import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LykkeTid",
  description: "Enkel dagsbaseret tidsregistrering",
};

/** Lets `env(safe-area-inset-*)` match the notch / home indicator on iPhone. */
export const viewport = {
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${poppins.variable} h-full min-h-dvh antialiased`}
    >
      <body className="flex h-full min-h-0 min-h-dvh flex-col overflow-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
