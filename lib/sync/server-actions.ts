// Key → server action, run on the server by runMutation
// (actions/sync/run-mutation.ts) so a validation error's message survives
// production builds — a server action that throws straight to the client
// arrives as a bare "Minified React error #441" instead. Deliberately
// scoped to finance/data-entry mutations: RBAC and payment confirmation
// (mark paid/unpaid) stay out, since those should fail loudly if offline,
// not silently replay later.

import {
  createEarning,
  updateEarning,
  deleteEarning,
  createExpense,
  updateExpense,
  deleteExpense,
  createDonation,
  updateDonation,
  deleteDonation,
} from "@/actions/finance/actions";
import {
  createContract,
  updateContract,
  deleteContract,
} from "@/actions/contracts/actions";
import { createInvoice, deleteInvoice } from "@/actions/invoices/actions";
import { createPayslip, deletePayslip } from "@/actions/team/payslip-actions";
import {
  createPartnerPayslip,
  deletePartnerPayslip,
} from "@/actions/partners/payslip-actions";
import {
  createPartnerInvestment,
  deletePartnerInvestment,
  createPartnerInvestmentSpend,
  deletePartnerInvestmentSpend,
} from "@/actions/partners/investment-actions";
import {
  createClient,
  updateClient,
  deleteClient,
} from "@/actions/clients/actions";
import {
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "@/actions/bank-accounts/actions";
import type { MilestoneInput } from "@/lib/contracts/constants";
import type { ActionKey } from "@/lib/sync/action-keys";
import type { InvoiceItemInput } from "@/actions/invoices/actions";

/** FormData isn't JSON-serializable — queued payloads carry the plain
 * object form instead, reconstructed back into a real FormData right
 * before the action call. All the forms in scope here are text-only
 * (no file inputs), so this round-trip is lossless. */
function toFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields))
    formData.append(key, value);
  return formData;
}

type IdPayload = { id: string };
type FieldsPayload = Record<string, string>;
type UpdatePayload = { id: string; formData: Record<string, string> };
type ContractCreatePayload = {
  formData: Record<string, string>;
  milestones: MilestoneInput[];
};
type ContractUpdatePayload = ContractCreatePayload & { id: string };
type InvoiceCreatePayload = {
  formData: Record<string, string>;
  items: InvoiceItemInput[];
};

export const SERVER_ACTIONS: Record<
  ActionKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per action; each entry's own type is what call sites actually use.
  (payload: any) => Promise<unknown>
> = {
  createEarning: (p: FieldsPayload) => createEarning(toFormData(p)),
  updateEarning: (p: UpdatePayload) =>
    updateEarning(p.id, toFormData(p.formData)),
  deleteEarning: (p: IdPayload) => deleteEarning(p.id),

  createExpense: (p: FieldsPayload) => createExpense(toFormData(p)),
  updateExpense: (p: UpdatePayload) =>
    updateExpense(p.id, toFormData(p.formData)),
  deleteExpense: (p: IdPayload) => deleteExpense(p.id),

  createDonation: (p: FieldsPayload) => createDonation(toFormData(p)),
  updateDonation: (p: UpdatePayload) =>
    updateDonation(p.id, toFormData(p.formData)),
  deleteDonation: (p: IdPayload) => deleteDonation(p.id),

  createContract: (p: ContractCreatePayload) =>
    createContract(toFormData(p.formData), p.milestones),
  updateContract: (p: ContractUpdatePayload) =>
    updateContract(p.id, toFormData(p.formData), p.milestones),
  deleteContract: (p: IdPayload) => deleteContract(p.id),

  createInvoice: (p: InvoiceCreatePayload) =>
    createInvoice(toFormData(p.formData), p.items),
  deleteInvoice: (p: IdPayload) => deleteInvoice(p.id),

  createPayslip: (p: FieldsPayload) => createPayslip(toFormData(p)),
  deletePayslip: (p: IdPayload) => deletePayslip(p.id),

  createPartnerPayslip: (p: FieldsPayload) =>
    createPartnerPayslip(toFormData(p)),
  deletePartnerPayslip: (p: IdPayload) => deletePartnerPayslip(p.id),

  createPartnerInvestment: (p: FieldsPayload) =>
    createPartnerInvestment(toFormData(p)),
  deletePartnerInvestment: (p: IdPayload) => deletePartnerInvestment(p.id),
  createPartnerInvestmentSpend: (p: FieldsPayload) =>
    createPartnerInvestmentSpend(toFormData(p)),
  deletePartnerInvestmentSpend: (p: IdPayload) =>
    deletePartnerInvestmentSpend(p.id),

  createClient: (p: FieldsPayload) => createClient(toFormData(p)),
  updateClient: (p: UpdatePayload) =>
    updateClient(p.id, toFormData(p.formData)),
  deleteClient: (p: IdPayload) => deleteClient(p.id),

  createBankAccount: (p: FieldsPayload) => createBankAccount(toFormData(p)),
  updateBankAccount: (p: UpdatePayload) =>
    updateBankAccount(p.id, toFormData(p.formData)),
  deleteBankAccount: (p: IdPayload) => deleteBankAccount(p.id),
};
