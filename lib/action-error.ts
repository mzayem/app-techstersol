/** A user-facing message for an error thrown by a server action.
 *
 * In production, Next.js replaces the message of any error a server action
 * throws with React's "Minified React error #441" (it hides server error
 * details on purpose), so showing `error.message` would put that raw text
 * in front of the user. This swaps it for `fallback`. Real messages still
 * come through in development, and for mutations run via
 * enqueueMutation/runMutation, which return the message as data. */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message;
  if (
    !message ||
    /Minified React error #441|Server Components render|server component/i.test(
      message,
    ) ||
    "digest" in error
  ) {
    return fallback;
  }
  return message;
}
