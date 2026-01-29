import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "C1 Handsontable - AI-Powered Spreadsheet",
  description: "An Excel-like spreadsheet with AI capabilities using Thesys C1 and Handsontable",
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
