import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crew — AI Agent Workbench",
  description: "A review-first AI agent workbench for planning, implementing, and testing changes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
