"use client";

// String key → server action call, used to replay a queued mutation (see
// lib/sync/queue.ts) after a reload, when the original closure is long
// gone. Deliberately scoped to finance/data-entry mutations only — RBAC
// (users/roles) and payment-confirmation actions (mark paid/unpaid) are
// excluded on purpose: those should fail loudly if offline, not silently
// apply later once the person who clicked them has moved on.

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
import { createContract, updateContract, deleteContract } from "@/actions/contracts/actions";
import { createInvoice, deleteInvoice } from "@/actions/invoices/actions";
import { createPayslip, deletePayslip } from "@/actions/team/payslip-actions";
import { createClient, updateClient, deleteClient } from "@/actions/clients/actions";
import {
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "@/actions/bank-accounts/actions";
import type { MilestoneInput } from "@/lib/contracts/constants";
import type { InvoiceItemInput } from "@/actions/invoices/actions";

/** FormData isn't JSON-serializable — queued payloads carry the plain
 * object form instead, reconstructed back into a real FormData right
 * before the action call. All the forms in scope here are text-only
 * (no file inputs), so this round-trip is lossless. */
function toFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  return formData;
}

/** The other direction — every in-scope dialog's onSubmit gets a FormData
 * from its <form action={...}>, and converts it to a plain object with
 * this before handing it to enqueueMutation. */
export function formDataToRecord(formData: FormData): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export type IdPayload = { id: string };
export type FieldsPayload = Record<string, string>;
export type UpdatePayload = { id: string; formData: Record<string, string> };
export type ContractCreatePayload = {
  formData: Record<string, string>;
  milestones: MilestoneInput[];
};
export type ContractUpdatePayload = ContractCreatePayload & { id: string };
export type InvoiceCreatePayload = {
  formData: Record<string, string>;
  items: InvoiceItemInput[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per action; each entry's own type is what call sites actually use.
export const ACTION_REGISTRY: Record<string, (payload: any) => Promise<unknown>> = {
  createEarning: (p: FieldsPayload) => createEarning(toFormData(p)),
  updateEarning: (p: UpdatePayload) => updateEarning(p.id, toFormData(p.formData)),
  deleteEarning: (p: IdPayload) => deleteEarning(p.id),

  createExpense: (p: FieldsPayload) => createExpense(toFormData(p)),
  updateExpense: (p: UpdatePayload) => updateExpense(p.id, toFormData(p.formData)),
  deleteExpense: (p: IdPayload) => deleteExpense(p.id),

  createDonation: (p: FieldsPayload) => createDonation(toFormData(p)),
  updateDonation: (p: UpdatePayload) => updateDonation(p.id, toFormData(p.formData)),
  deleteDonation: (p: IdPayload) => deleteDonation(p.id),

  createContract: (p: ContractCreatePayload) =>
    createContract(toFormData(p.formData), p.milestones),
  updateContract: (p: ContractUpdatePayload) =>
    updateContract(p.id, toFormData(p.formData), p.milestones),
  deleteContract: (p: IdPayload) => deleteContract(p.id),

  createInvoice: (p: InvoiceCreatePayload) => createInvoice(toFormData(p.formData), p.items),
  deleteInvoice: (p: IdPayload) => deleteInvoice(p.id),

  createPayslip: (p: FieldsPayload) => createPayslip(toFormData(p)),
  deletePayslip: (p: IdPayload) => deletePayslip(p.id),

  createClient: (p: FieldsPayload) => createClient(toFormData(p)),
  updateClient: (p: UpdatePayload) => updateClient(p.id, toFormData(p.formData)),
  deleteClient: (p: IdPayload) => deleteClient(p.id),

  createBankAccount: (p: FieldsPayload) => createBankAccount(toFormData(p)),
  updateBankAccount: (p: UpdatePayload) => updateBankAccount(p.id, toFormData(p.formData)),
  deleteBankAccount: (p: IdPayload) => deleteBankAccount(p.id),
};

export type ActionKey = keyof typeof ACTION_REGISTRY;
