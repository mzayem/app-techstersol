"use client";

import * as React from "react";

import { toast } from "@/components/ui/toast";

export function AuthErrorToast({ message }: { message: string }) {
  React.useEffect(() => {
    toast.add({ title: message, type: "error" });
  }, [message]);

  return null;
}
