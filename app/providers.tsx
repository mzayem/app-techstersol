"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";

import { SESSION_CHANGED_EVENT } from "@/components/auth/auth-form-gate";
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
      onSessionChange={() => {
        window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
        router.refresh();
      }}
      redirectTo={inPortal ? "/portal" : "/"}
      signUp={false}
      social={{ providers: ["google"] }}
      avatar
      account={{ basePath: inPortal ? "/portal/profile" : "/profile" }}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
