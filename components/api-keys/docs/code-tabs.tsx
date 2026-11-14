"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CodeBlock, type CodeLang } from "./code-block";
import { useState } from "react";

export type CodeTab = {
  id: string;
  label: string;
  lang: CodeLang;
  code: string;
};

export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <Tabs value={active} onValueChange={(v) => setActive(String(v))}>
      <TabsList className="h-9 rounded-lg p-[3px]">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="px-3">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <CodeBlock
        code={current.code}
        lang={current.lang}
        label={current.label}
      />
    </Tabs>
  );
}
