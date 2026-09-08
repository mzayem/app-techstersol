"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useMounted } from "@/lib/hooks/use-mounted";

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

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
