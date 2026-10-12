import type * as React from "react";

/** Use as `<form onSubmit={(e) => submitForm(e, onSubmit)}>` instead of
 * `<form action={onSubmit}>`. React 19 resets a form after every `action`
 * submission — even one the server rejected — wiping everything the user
 * typed. A plain submit handler leaves the fields alone; each dialog
 * already resets its form itself after a successful save. The browser's
 * own validation (`required`, `type="email"`…) still runs first. */
export function submitForm(
  event: React.FormEvent<HTMLFormElement>,
  handler: (formData: FormData) => void,
) {
  event.preventDefault();
  handler(new FormData(event.currentTarget));
}

/** Dropdowns/comboboxes submit through hidden inputs, which the browser's
 * `required` check ignores — so an empty Country or Currency would reach
 * the server. Returns a message naming every empty one (e.g. "Please
 * choose a country and a payment currency."), or null when all are set.
 * `fields` maps each input name to how it reads in that sentence. */
export function missingChoices(
  formData: FormData,
  fields: Record<string, string>,
): string | null {
  const missing = Object.entries(fields)
    .filter(([name]) => !String(formData.get(name) ?? "").trim())
    .map(([, label]) => label);
  if (missing.length === 0) return null;
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Please choose ${list}.`;
}
