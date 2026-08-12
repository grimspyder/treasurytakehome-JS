import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "VeriLabel — Alcohol Label Review Assistant",
  description:
    "VeriLabel helps TTB compliance reviewers quickly check that information on an alcohol beverage label matches the corresponding application. AI-assisted extraction with transparent, human-reviewable results.",
};

/**
 * Inline script sets the theme attribute before hydration to avoid an
 * incorrect-theme flash. Light is the default; the stored/system preference
 * overrides it via the use-theme hook.
 */
const themeBootScript = `
(function () {
  try {
    var stored = localStorage.getItem('verilabel-theme');
    if (stored === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); }
    else if (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}