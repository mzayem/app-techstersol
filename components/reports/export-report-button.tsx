"use client";

import { useSearchParams } from "next/navigation";
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Download button shown on list pages — exports the currently filtered
 * rows to Excel or PDF via `/api/reports/[module]`. */
export function ExportReportButton({ module }: { module: string }) {
  const searchParams = useSearchParams();

  function hrefFor(format: "xlsx" | "pdf") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", format);
    return `/api/reports/${module}?${params.toString()}`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <DownloadIcon />
        Download
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Export as</DropdownMenuLabel>
          <DropdownMenuItem render={<a href={hrefFor("xlsx")} />}>
            <FileSpreadsheetIcon />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={hrefFor("pdf")} />}>
            <FileTextIcon />
            PDF
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
