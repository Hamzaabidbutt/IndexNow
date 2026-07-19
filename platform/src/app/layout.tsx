import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "IndexJet Platform — URL Indexing & Discovery Engine", template: "%s | IndexJet" },
  description:
    "Submit any URL from any domain. Crawlability diagnostics, IndexNow submission, sitemap & RSS generation, queue-driven processing with retries.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
