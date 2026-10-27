import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "SightSync",
  description: "SightSync Environmental Safety System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
