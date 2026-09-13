import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { requireTeamUser } from "@/lib/rbac/permissions";
import { listMyProjects } from "@/actions/portal/queries";
import { ContractChatButton } from "@/components/contracts/contract-chat";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Proposed",
  UPFRONT_PAYMENT: "Upfront payment",
  ACTIVE: "Active",
  PENDING_PAYMENT: "Pending payment",
  PARTIALLY_PAID: "Partially paid",
  COMPLETED: "Completed",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
};

export default async function PortalProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireTeamUser();
  const params = await searchParams;
  const projects = await listMyProjects(appUser.teamMember!.id);
  const paginated = paginate(projects, parsePageParam(params.page), parsePageSizeParam(params.pageSize));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">My Projects</h1>
        <p className="text-sm text-muted-foreground">
          Project name and deadline only — amounts and client details aren&apos;t shown here.
        </p>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No projects assigned to you yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.projectName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(project.deadline)}
                </TableCell>
                <TableCell>{STATUS_LABELS[project.status] ?? project.status}</TableCell>
                <TableCell>
                  <ContractChatButton
                    contractId={project.id}
                    projectName={project.projectName}
                    readOnly
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          pageSize={paginated.pageSize}
        />
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
