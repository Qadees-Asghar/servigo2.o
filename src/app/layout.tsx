import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SERVIGO - Book trusted local services",
  description:
    "SERVIGO connects customers with verified electricians, plumbers, mechanics and more. Browse services, pick a slot, and track every booking in one place.",
  applicationName: "SERVIGO",
  authors: [{ name: "Qadees Asghar" }],
  openGraph: {
    title: "SERVIGO - Book trusted local services",
    description:
      "Browse verified providers, pick a time slot, and track every booking in one place.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0f14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
