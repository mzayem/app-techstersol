import { ClientContractRequestDialog } from "@/components/client-portal/client-contract-request-dialog";
import { ContractStatusStepper } from "@/components/client-portal/contract-status-stepper";
import { ContractChatButton } from "@/components/contracts/contract-chat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatContractAmount } from "@/lib/contracts/constants";
import { requireClientUser } from "@/lib/rbac/permissions";
import { listMyContracts } from "@/actions/client-portal/queries";

export const dynamic = "force-dynamic";

export default async function ClientContractsPage() {
  const appUser = await requireClientUser();
  const contracts = await listMyContracts(appUser.client!.id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Your projects with us. Add a note any time — our team sees it right away.
          </p>
        </div>
        <ClientContractRequestDialog />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No projects yet — send us a request to get started.
                </TableCell>
              </TableRow>
            )}
            {contracts.map((contract) => {
              const total =
                contract.paymentType === "PROJECT"
                  ? (contract.amount ?? 0)
                  : contract.milestones.reduce((sum, m) => sum + m.amount, 0);
              return (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.projectName}
                    {contract.description && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {contract.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(contract.deadline)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatContractAmount(total, contract.currency)}
                  </TableCell>
                  <TableCell>
                    <ContractStatusStepper status={contract.status} />
                  </TableCell>
                  <TableCell>
                    <ContractChatButton
                      contractId={contract.id}
                      projectName={contract.projectName}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
