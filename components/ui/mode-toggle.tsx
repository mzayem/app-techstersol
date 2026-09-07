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

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function ModeToggle() {
  const { theme = "system", setTheme } = useTheme();

  // `theme` is undefined on the server and on the first client render alike
  // (next-themes only resolves it from storage after mount), so this default
  // renders identically both times — no hydration mismatch, no effect needed.
  const Icon = THEME_ICONS[theme as keyof typeof THEME_ICONS] ?? Monitor;

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
