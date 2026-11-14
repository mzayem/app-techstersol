import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { REFERENCE_CURRENCIES } from "@/lib/finance/constants";
import { requirePagePermission } from "@/lib/rbac/permissions";

import { Callout } from "./docs/callout";
import { CodeBlock } from "./docs/code-block";
import { CodeTabs } from "./docs/code-tabs";
import { DocsShell, type DocsPage } from "./docs/docs-shell";
import { BaseUrlChip, EndpointBar } from "./docs/endpoint-bar";
import { FieldTable, SimpleTable, type Field } from "./docs/field-table";

const FIELDS: Field[] = [
  {
    name: "externalId",
    type: "string",
    required: true,
    description:
      "Your own unique id for this payment (an invoice number works). 1–200 characters. Sending the same value again never books a second earning.",
  },
  {
    name: "name",
    type: "string",
    required: true,
    description:
      "How the earning appears in the Earning list, 1–200 characters. Put the invoice number here so it can be traced back.",
  },
  {
    name: "amount",
    type: "number",
    required: true,
    description:
      "PKR actually received, net of any fees. Greater than 0, at most 2 decimal places, up to 999,999,999,999.99.",
  },
  {
    name: "date",
    type: "string",
    required: false,
    description:
      "YYYY-MM-DD, a real calendar date. Defaults to today in Karachi (Asia/Karachi).",
  },
  {
    name: "teamPay",
    type: "number",
    required: false,
    description:
      "Portion of the amount paid out to the team. 0 or more, never more than amount. Defaults to 0. Booked as a separate team-payment ledger entry.",
  },
  {
    name: "referenceAmount",
    type: "number",
    required: false,
    description:
      "The original amount in a foreign currency, for reference only. Greater than 0. Must be sent together with referenceCurrency.",
  },
  {
    name: "referenceCurrency",
    type: "string",
    required: false,
    description: `One of ${REFERENCE_CURRENCIES.join(", ")}. Must be sent together with referenceAmount.`,
  },
];

const STATUSES: {
  status: string;
  code: string;
  meaning: string;
  retry: string;
}[] = [
  {
    status: "201",
    code: "—",
    meaning: "Earning booked.",
    retry: "Done.",
  },
  {
    status: "200",
    code: "—",
    meaning:
      "This externalId was already booked; the existing earning's id is returned and nothing changes.",
    retry: "Done. Treat as success.",
  },
  {
    status: "400",
    code: "invalid_json",
    meaning: "The body isn't valid JSON.",
    retry: "Fix the request.",
  },
  {
    status: "401",
    code: "unauthorized",
    meaning: "Missing, invalid, revoked or expired API key.",
    retry: "Fix the key; don't retry as is.",
  },
  {
    status: "422",
    code: "invalid_request",
    meaning:
      "A field failed validation. The message lists each one as field: reason.",
    retry: "Fix the request.",
  },
  {
    status: "429",
    code: "too_many_requests",
    meaning: "Rate limit exceeded.",
    retry: "Wait the number of seconds in the Retry-After header.",
  },
  {
    status: "500",
    code: "—",
    meaning: "Unexpected server error.",
    retry: "Safe to retry with the same externalId.",
  },
];

const CREATED = `HTTP/1.1 201 Created
{ "id": "cm3x...", "created": true }`;

const REPEAT = `HTTP/1.1 200 OK
{ "id": "cm3x...", "created": false }`;

const ERROR = `HTTP/1.1 422 Unprocessable Entity
{
  "error": {
    "code": "invalid_request",
    "message": "amount: Too small: expected number to be >0"
  }
}`;

const REMOVED = `HTTP/1.1 200 OK
{ "id": "cm3x...", "deleted": true }`;

const NOT_FOUND = `HTTP/1.1 404 Not Found
{ "error": { "code": "not_found", "message": "..." } }`;

function curlCreate(base: string) {
  return `curl -X POST ${base}/api/v1/earnings \\
  -H "Authorization: Bearer tsk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "INV-0042",
    "date": "2026-11-15",
    "name": "Softifex ERP – Acme Ltd (INV-0042)",
    "amount": 33500,
    "referenceAmount": 120,
    "referenceCurrency": "USD"
  }'`;
}

function jsCreate(base: string) {
  return `const res = await fetch("${base}/api/v1/earnings", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.TECHSTERSOL_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    externalId: "INV-0042",
    name: "Softifex ERP – Acme Ltd (INV-0042)",
    amount: 33500,
  }),
});

if (!res.ok) throw new Error((await res.json()).error.message);
const { id, created } = await res.json();`;
}

function pythonCreate(base: string) {
  return `import os, requests

res = requests.post(
    "${base}/api/v1/earnings",
    headers={"Authorization": f"Bearer {os.environ['TECHSTERSOL_API_KEY']}"},
    json={
        "externalId": "INV-0042",
        "name": "Softifex ERP – Acme Ltd (INV-0042)",
        "amount": 33500,
    },
    timeout=15,
)
res.raise_for_status()
print(res.json())  # {"id": "...", "created": True}`;
}

function curlRemove(base: string) {
  return `curl -X DELETE ${base}/api/v1/earnings/cm3x... \\
  -H "Authorization: Bearer tsk_..."`;
}

function jsRemove(base: string) {
  return `const res = await fetch("${base}/api/v1/earnings/cm3x...", {
  method: "DELETE",
  headers: {
    Authorization: \`Bearer \${process.env.TECHSTERSOL_API_KEY}\`,
  },
});

// 200 = removed, 404 = already removed (or not yours): both are fine.
if (!res.ok && res.status !== 404) {
  throw new Error((await res.json()).error.message);
}`;
}

function pythonRemove(base: string) {
  return `import os, requests

res = requests.delete(
    "${base}/api/v1/earnings/cm3x...",
    headers={"Authorization": f"Bearer {os.environ['TECHSTERSOL_API_KEY']}"},
    timeout=15,
)
# 200 = removed, 404 = already removed (or not yours): both are fine.
if res.status_code != 404:
    res.raise_for_status()`;
}

async function resolveBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "https://<your-domain>";
  const hostname = host.split(":")[0];
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwarded || (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

function PageHead({
  n,
  title,
  lead,
}: {
  n: number;
  title: string;
  lead: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      <span className="text-xs font-bold tracking-wider text-primary uppercase">
        Section {n}
      </span>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{lead}</p>
    </header>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
      {children}
    </ul>
  );
}

function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  );
}

export async function ApiDocsView({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  await requirePagePermission("api-keys");
  const base = await resolveBaseUrl();

  const pages: DocsPage[] = [
    {
      id: "introduction",
      group: "Getting started",
      title: "Introduction",
      content: (
        <>
          <PageHead
            n={1}
            title="Introduction"
            lead="Push earnings into this system from other software. Invoices stay in the calling software — only the money received is sent here."
          />
          <Bullets>
            <li>
              Two endpoints: create an earning (<C>POST</C>) and remove one you
              pushed earlier (<C>DELETE</C>). The request and response are JSON.
            </li>
            <li>
              Authenticate with an API key, issued on the API Keys page. Keys
              are limited to 120 requests per minute.
            </li>
          </Bullets>
          <CodeBlock code={`${base}/api/v1`} lang="text" label="base url" />
        </>
      ),
    },
    {
      id: "authentication",
      group: "Getting started",
      title: "Authentication",
      content: (
        <>
          <PageHead
            n={2}
            title="Authentication"
            lead={
              <>
                Send an API key issued on the API Keys page in the{" "}
                <C>Authorization</C> header. Issue one key per software — its
                name is stored as the <em>source</em> of every earning it pushes
                and shows as the actor in the Activity Log.
              </>
            }
          />
          <CodeBlock code="Authorization: Bearer tsk_..." lang="http" />
          <Bullets>
            <li>The key is shown once, when issued. Store it as a secret.</li>
            <li>
              A key can have an expiry date; after it, requests get 401, the
              same as for a revoked key.
            </li>
          </Bullets>
          <Callout variant="warning" title="Keys are server-side only">
            Keep keys server-side — never in browser or mobile code.
          </Callout>
        </>
      ),
    },
    {
      id: "rate-limits",
      group: "Getting started",
      title: "Rate limits",
      content: (
        <>
          <PageHead
            n={3}
            title="Rate limits"
            lead="Limits apply per key, and to repeated failed authentication per IP address."
          />
          <Bullets>
            <li>
              Each key may make up to <strong>120 requests per minute</strong>.
              Beyond that you get 429 with a <C>Retry-After</C> header.
            </li>
            <li>
              Repeated requests with a bad, revoked or expired key are limited
              per IP address (20 failures per 5 minutes) and then also get 429.
            </li>
          </Bullets>
        </>
      ),
    },
    {
      id: "create",
      group: "Endpoints",
      title: "Create earning",
      badge: "POST",
      content: (
        <>
          <PageHead
            n={4}
            title="Create earning"
            lead={
              <>
                Books one earning, exactly like adding it by hand on the Earning
                page: it appears in the Earning list, feeds the balance sheet
                and distributions, and writes a ledger entry (plus a
                team-payment entry when <C>teamPay</C> is set). The request and
                response are JSON.
              </>
            }
          />
          <EndpointBar
            method="POST"
            path="/api/v1/earnings"
            copyText={`${base}/api/v1/earnings`}
          />

          <Sub>Request body</Sub>
          <FieldTable fields={FIELDS} />
          <Callout title="Amount is net PKR">
            Send <C>amount</C> in PKR, net of fees — what actually landed in the
            account. Put the original foreign amount in <C>referenceAmount</C>/
            <C>referenceCurrency</C>.
          </Callout>

          <Sub>Example request</Sub>
          <CodeTabs
            tabs={[
              {
                id: "curl",
                label: "curl",
                lang: "bash",
                code: curlCreate(base),
              },
              {
                id: "js",
                label: "JavaScript (Node 18+)",
                lang: "js",
                code: jsCreate(base),
              },
              {
                id: "py",
                label: "Python",
                lang: "python",
                code: pythonCreate(base),
              },
            ]}
          />

          <Sub>Responses</Sub>
          <div className="grid gap-3 md:grid-cols-2">
            <CodeBlock title="New earning" code={CREATED} lang="http" />
            <CodeBlock
              title="Repeat of an existing externalId"
              code={REPEAT}
              lang="http"
            />
          </div>

          <Sub>Idempotency</Sub>
          <Callout title="externalId is the idempotency key">
            <C>externalId</C> makes retries safe. If a request times out or you
            aren&apos;t sure it arrived, send it again with the same{" "}
            <C>externalId</C>: the first call books the earning (201), and every
            repeat returns that same earning with <C>created: false</C> (200)
            without booking anything new.
          </Callout>
          <Bullets>
            <li>
              Uniqueness is per software name, so two different integrations can
              use the same ids. A key re-issued under the same name continues
              the same set.
            </li>
            <li>
              A repeat is matched on <C>externalId</C> only — the other fields
              of the repeat are ignored, even if they differ. To correct an
              earning, edit it in the Earning list.
            </li>
            <li>
              Use something stable per payment (invoice number, or{" "}
              <C>license-id:period</C>), never a random value generated per
              attempt.
            </li>
          </Bullets>
        </>
      ),
    },
    {
      id: "remove",
      group: "Endpoints",
      title: "Remove earning",
      badge: "DELETE",
      content: (
        <>
          <PageHead
            n={5}
            title="Remove an earning (mark an invoice unpaid)"
            lead={
              <>
                Removes an earning you pushed earlier, by the <C>id</C> returned
                when it was created — use it when an invoice is marked unpaid in
                the calling software. The earning and its ledger entries
                disappear from the Earning list, balance sheet and
                distributions. No request body.
              </>
            }
          />
          <EndpointBar
            method="DELETE"
            path="/api/v1/earnings/{id}"
            copyText={`${base}/api/v1/earnings/{id}`}
          />

          <Sub>Example request</Sub>
          <CodeTabs
            tabs={[
              {
                id: "curl",
                label: "curl",
                lang: "bash",
                code: curlRemove(base),
              },
              {
                id: "js",
                label: "JavaScript (Node 18+)",
                lang: "js",
                code: jsRemove(base),
              },
              {
                id: "py",
                label: "Python",
                lang: "python",
                code: pythonRemove(base),
              },
            ]}
          />

          <Sub>Responses</Sub>
          <div className="grid gap-3 md:grid-cols-2">
            <CodeBlock title="Removed" code={REMOVED} lang="http" />
            <CodeBlock
              title="Not found / not yours"
              code={NOT_FOUND}
              lang="http"
            />
          </div>
          <Callout title="404 also means already removed">
            404 also means &quot;already removed&quot;, so a retry after a
            timeout is safe — treat 404 as done.
          </Callout>
          <Bullets>
            <li>
              A key can only remove earnings pushed under its own software name.
              Manual earnings and ones from other software answer 404, exactly
              like an unknown id.
            </li>
            <li>
              Marking the invoice paid again later? Just push it again. Once the
              earning is removed its <C>externalId</C> is free, so the same
              value books a fresh earning (201) with a new id.
            </li>
            <li>
              Same authentication and rate limits as creating. Each removal is
              written to the Activity Log under the software&apos;s name.
            </li>
          </Bullets>
        </>
      ),
    },
    {
      id: "errors",
      group: "Reference",
      title: "Errors",
      content: (
        <>
          <PageHead
            n={6}
            title="Errors"
            lead="Every error uses the same shape."
          />
          <CodeBlock code={ERROR} lang="http" />
          <SimpleTable
            columns={[
              { header: "Status" },
              { header: "Code" },
              { header: "Meaning" },
              { header: "What to do" },
            ]}
            rows={STATUSES.map((s) => [
              <span
                key="s"
                className="font-mono text-xs font-medium text-foreground"
              >
                {s.status}
              </span>,
              <span key="c" className="font-mono text-xs">
                {s.code}
              </span>,
              s.meaning,
              s.retry,
            ])}
          />
        </>
      ),
    },
    {
      id: "good-to-know",
      group: "Reference",
      title: "Good to know",
      content: (
        <>
          <PageHead
            n={7}
            title="Good to know"
            lead="A few behaviours worth knowing before you integrate."
          />
          <Bullets>
            <li>
              Send <C>amount</C> in PKR, net of fees — what actually landed in
              the account. Put the original foreign amount in{" "}
              <C>referenceAmount</C>/<C>referenceCurrency</C>.
            </li>
            <li>
              Earnings pushed this way aren&apos;t linked to an invoice here, so
              there is no automatic partner profit-split or contract completion.
              Use <C>teamPay</C> for the team&apos;s cut.
            </li>
            <li>
              To correct a pushed earning, edit it in the Earning list. The API
              can create earnings and remove ones it created, but not edit them.
            </li>
          </Bullets>
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            {backLabel}
          </Link>
          <h1 className="text-2xl font-bold">API documentation</h1>
          <p className="text-sm text-muted-foreground">
            Push earnings into this system from other software. Invoices stay in
            the calling software — only the money received is sent here.
          </p>
        </div>
        <BaseUrlChip url={base} />
      </div>

      <DocsShell pages={pages} />
    </div>
  );
}
