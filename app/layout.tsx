import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toast";
import { SyncProvider } from "@/components/sync/sync-provider";
import { Providers } from "@/app/providers";
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@/components/ui/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Techstersol",
  description: "Techstersol — technology solutions.",
  appleWebApp: {
    capable: true,
    title: "Techstersol",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <div
          id="app-splash"
          suppressHydrationWarning
          style={{ display: "none" }}
          className="fixed inset-0 z-9999 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0c0a09]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- must paint before any JS (including next/image's client runtime) loads */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="rounded-2xl"
          />
          <span className="text-sm font-medium text-[#ca3500]">
            Techstersol
          </span>
        </div>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
              if (!isStandalone) return;
              var splash = document.getElementById('app-splash');
              if (!splash) return;
              splash.style.display = 'flex';
              window.addEventListener('load', function () {
                splash.style.transition = 'opacity 300ms ease';
                splash.style.opacity = '0';
                setTimeout(function () { splash.style.display = 'none'; }, 320);
              });
            })();`,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <main>
              <NextTopLoader color="#F87929" showSpinner={false} />
              {children}
            </main>
            <Toaster />
            <SyncProvider />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
