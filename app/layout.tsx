import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "SightSync",
  description: "SightSync — Visual Comfort and Environmental Awareness",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { var t = localStorage.getItem("smart-spectacles-theme"); if (["green-light","green-dark","peach-light","peach-dark","stone-light","slate-dark"].includes(t)) document.documentElement.dataset.theme = t; } catch (e) {}`,
          }}
        />
      </head>
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
