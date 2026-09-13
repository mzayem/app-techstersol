import { COMPANY_INFO } from "@/lib/invoices/constants";

/** Brand tokens for email — the gold→orange→red gradient stays the one
 * constant accent (it reads fine against both a light and a dark host
 * background), but everything else is now theme-aware: no forced page
 * background (the email client's own light/dark background shows through),
 * a translucent "glassy" grey card instead of a solid dark surface, and
 * text colors that default to a light-background-appropriate palette with
 * a `prefers-color-scheme: dark` override for clients that support it
 * (Apple/iOS Mail, Outlook desktop dark mode, etc). Email clients don't
 * reliably render custom fonts either, so the font stack falls back to
 * system sans-serif after "Outfit". */
const COLORS = {
  gold: "#f5a623",
  orange: "#e8621a",
  red: "#c0392b",
};

const FONT_STACK = "'Outfit', Arial, Helvetica, sans-serif";

/** Dark-mode overrides for every themed class below — `!important` is
 * required here since these need to beat each element's own inline
 * (light-mode-default) style once the media query matches. Kept in one
 * place so every template shares exactly the same dark palette. */
const DARK_MODE_STYLE = `
  @media (prefers-color-scheme: dark) {
    .em-panel { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.14) !important; }
    .em-heading { color: #f5f4f0 !important; }
    .em-text { color: #c7c5c0 !important; }
    .em-muted { color: #8f8d88 !important; }
    .em-divider { border-color: rgba(255,255,255,0.12) !important; }
    .em-footer { color: rgba(255,255,255,0.4) !important; }
  }
`;

/** Every interpolated value that ultimately comes from user input (a
 * project name, a chat message, a client's own name) must go through this
 * before landing in an email template — none of the builders in this
 * directory otherwise escape their inputs. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A labelled pill, e.g. "NEW PROPOSAL" atop the card — mirrors
 * `.tsv-badge` on the verify page. The gold tint reads fine on both a
 * light and a dark card, so this needs no dark-mode override. */
export function emailBadge(label: string) {
  return `
    <span style="display:inline-block;background:rgba(245,166,35,0.12);border:1px solid rgba(245,166,35,0.4);color:#b5730f;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 16px;border-radius:100px;font-family:${FONT_STACK};">
      ${label}
    </span>
  `;
}

/** A gradient-styled CTA button (falls back to solid orange where the
 * background-image gradient isn't supported, e.g. Outlook desktop). White
 * text on a saturated gradient reads fine in both themes, so no override
 * needed here either. */
export function emailButton(label: string, href: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr>
        <td bgcolor="${COLORS.orange}" style="background:${COLORS.orange};background-image:linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.orange} 50%, ${COLORS.red} 100%);border-radius:100px;">
          <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-family:${FONT_STACK};font-weight:700;font-size:15px;text-decoration:none;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/** A two-column "Field / Details" row, mirroring `.tsv-verify-row`. `label`
 * is always a static string we control; `value` is often user-supplied
 * (a project/client name) so it's escaped here rather than trusting every
 * call site to remember. */
export function emailInfoRow(label: string, value: string) {
  return `
    <tr>
      <td class="em-heading em-divider" style="padding:14px 20px;border-bottom:1px solid rgba(0,0,0,0.08);border-right:1px solid rgba(0,0,0,0.08);color:#18181b;font-size:13px;font-weight:600;font-family:${FONT_STACK};white-space:nowrap;">
        ${label}
      </td>
      <td class="em-text em-divider" style="padding:14px 20px;border-bottom:1px solid rgba(0,0,0,0.08);color:#4b4b52;font-size:14px;font-weight:300;font-family:${FONT_STACK};">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

export function emailInfoTable(rows: string) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-panel" style="background:rgba(120,120,130,0.08);border:1px solid rgba(120,120,130,0.2);border-radius:14px;overflow:hidden;">
      ${rows}
    </table>
  `;
}

/** Shared wrapper every transactional email renders through — glassy
 * translucent card, gradient top strip, Techstersol wordmark header,
 * muted footer with the same company details used on invoice/payslip
 * PDFs. No page background is set, so the email client's own light/dark
 * background shows through around the card. Everything is inline styles +
 * table layout, since HTML email can't rely on Tailwind classes — the one
 * <style> block here only carries the dark-mode overrides, which enough
 * clients honor to be worth the graceful-degradation cost for the rest. */
export function renderEmailShell({
  title,
  bodyHtml,
}: {
  title: string;
  bodyHtml: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title}</title>
    <style>${DARK_MODE_STYLE}</style>
  </head>
  <body style="margin:0;padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="em-panel" style="width:100%;max-width:600px;background:rgba(120,120,130,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(120,120,130,0.22);border-radius:20px;overflow:hidden;">
            <tr>
              <td height="4" style="background:${COLORS.orange};background-image:linear-gradient(90deg, ${COLORS.gold}, ${COLORS.orange}, ${COLORS.red});font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <span class="em-heading" style="font-family:${FONT_STACK};font-size:18px;font-weight:900;letter-spacing:1px;color:#18181b;text-transform:uppercase;">
                  Techster<span style="font-weight:400;">sol</span>
                </span>
              </td>
            </tr>
            <tr>
              <td class="em-heading" style="padding:24px 40px 40px 40px;font-family:${FONT_STACK};color:#18181b;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td class="em-divider" style="padding:20px 40px;border-top:1px solid rgba(0,0,0,0.08);">
                <p class="em-footer" style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.7;color:rgba(0,0,0,0.45);">
                  ${COMPANY_INFO.name} · ${COMPANY_INFO.addressLines.join(", ")}<br />
                  ${COMPANY_INFO.email} · ${COMPANY_INFO.phone}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
