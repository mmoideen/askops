import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AskOps",
  description: "Internal knowledge assistant prototype",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
