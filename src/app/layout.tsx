import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/session-provider";
import { UIThemeProvider } from "@/components/providers/ui-theme-provider";
import { NavigationProvider } from "@/components/providers/navigation-provider";
// 7.7 (owner ruling 2026-07-15): the AI provider chain (ReflinkSessionProvider
// + ConversationalAgentProvider + pill) mounts ONCE here, above the router
// outlet, so a live voice/text session survives every client-side navigation.
// The wrapper itself gates the pill to its designated surfaces and stays out
// of /admin entirely (voice-debug mounts its own provider chain).
import { AIInterfaceWrapper } from "@/components/ai/ai-interface-wrapper";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portfolio Projects",
  description: "A showcase of creative and technical projects",
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin gate for the dev voice panel + context-debug panel (server-side, as
  // the per-page mounts did it before the 7.7 lift).
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

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
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <UIThemeProvider enableSystem>
          <SessionProvider>
            <NavigationProvider>
              <ToastProvider>
                {children}
                {/* No defaultProvider prop: the admin-configured site default governs */}
                <AIInterfaceWrapper isAdmin={isAdmin} />
              </ToastProvider>
            </NavigationProvider>
          </SessionProvider>
        </UIThemeProvider>
      </body>
    </html>
  );
}