import { ContractDialog } from "@/components/contracts/contract-dialog";
import { ContractFilterBar } from "@/components/contracts/contract-filter-bar";
import { ContractTable, type ContractListItem } from "@/components/contracts/contract-table";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type { ContractPaymentType, ContractStatus } from "@/lib/contracts/constants";
import { listClientOptions, listContracts, type SortOption } from "@/actions/contracts/queries";

export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const [contracts, clients] = await Promise.all([
    listContracts({
      search: params.q,
      status: params.status as ContractStatus | undefined,
      sort: params.sort as SortOption | undefined,
    }),
    listClientOptions(),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    currency: c.currency as PaymentCurrency,
  }));

  const items: ContractListItem[] = contracts.map((contract) => {
    const milestones = contract.milestones.map((m) => ({
      name: m.name,
      amount: Number(m.amount),
      deadline: m.deadline,
    }));
    const amount = contract.amount ? Number(contract.amount) : null;
    const totalAmount =
      contract.paymentType === "MILESTONE"
        ? milestones.reduce((sum, m) => sum + m.amount, 0)
        : (amount ?? 0);

    return {
      id: contract.id,
      clientId: contract.clientId,
      clientName: contract.client.name,
      date: contract.date,
      deadline: contract.deadline,
      projectName: contract.projectName,
      description: contract.description,
      currency: contract.currency as PaymentCurrency,
      paymentType: contract.paymentType as ContractPaymentType,
      amount,
      status: contract.status as ContractStatus,
      milestones,
      totalAmount,
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Contracts</h1>
        <ContractDialog clients={clientOptions} />
      </div>

      <ContractFilterBar />

      <ContractTable contracts={items} clients={clientOptions} />
    </div>
  );
}
