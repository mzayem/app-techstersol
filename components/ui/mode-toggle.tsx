"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

const subscribeNever = () => () => {};

/** True only once hydration has completed. Backed by `useSyncExternalStore`
 * (rather than a `useEffect` + `setState`) so there's no synchronous
 * setState-in-effect to trigger a cascading-render lint error — React
 * itself re-renders once the client snapshot ("true") differs from the
 * server one ("false"), right after hydration. */
function useMounted() {
  return React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function ModeToggle() {
  const { theme = "system", setTheme } = useTheme();
  // next-themes actually resolves the stored theme synchronously on the
  // client's first render (not after mount as one might expect), so it can
  // already differ from the server's render — gate the theme-dependent icon
  // behind a mount flag so the first client render always matches the
  // server's, and only swap to the real icon once it's safe to.
  const mounted = useMounted();

  const Icon = mounted
    ? (THEME_ICONS[theme as keyof typeof THEME_ICONS] ?? Monitor)
    : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton tooltip="Theme" />}>
        <Icon />
        <span>Theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
