import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { UIThemeProvider } from "@/components/providers/ui-theme-provider";
import { NavigationProvider } from "@/components/providers/navigation-provider";
// Removed reflink session provider from global layout
import { ToastProvider } from "@/components/ui/toast";
import TimingDebugInitializer from "@/components/debug/TimingDebugInitializer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portfolio Projects",
  description: "A showcase of creative and technical projects",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('portfolio-theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.add(theme);
                } catch (e) {
                  document.documentElement.classList.add('light');
                }
              })();
              
              // Initialize timing debug placeholder
              window.timingDebugReady = false;
              window.initTimingDebug = function() {
                if (!window.timingDebugReady) {
                  console.log('⏳ Timing debug is loading...');
                }
              };
            `,
          }}
        />
        <script src="/timing-debug.js" async></script>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <UIThemeProvider enableSystem>
          <SessionProvider>
            <NavigationProvider>
              <ToastProvider>
                <TimingDebugInitializer />
                {children}
              </ToastProvider>
            </NavigationProvider>
          </SessionProvider>
        </UIThemeProvider>
      </body>
    </html>
  );
}