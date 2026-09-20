"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PartnerInvestmentsTabs({
  investmentsTable,
  spendingTable,
}: {
  investmentsTable: React.ReactNode;
  spendingTable: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="investments">
      <TabsList>
        <TabsTrigger value="investments">Investments</TabsTrigger>
        <TabsTrigger value="spending">Spending</TabsTrigger>
      </TabsList>
      <TabsContent value="investments" className="mt-4">
        {investmentsTable}
      </TabsContent>
      <TabsContent value="spending" className="mt-4">
        {spendingTable}
      </TabsContent>
    </Tabs>
  );
}
