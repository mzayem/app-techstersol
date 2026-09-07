"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";

import { authClient } from "@/lib/auth-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const inPortal = pathname.startsWith("/portal");

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      redirectTo={inPortal ? "/portal" : "/"}
      signUp={false}
      social={{ providers: ["google"] }}
      account={{ basePath: inPortal ? "/portal/profile" : "/profile" }}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
