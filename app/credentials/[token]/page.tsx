import { Outfit } from "next/font/google";
import { KeyRound } from "lucide-react";

import { consumeCredentialLink } from "@/lib/mail/credential-link";
import { CopyPasswordButton } from "./copy-password-button";

export const dynamic = "force-dynamic";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

// Same dark/gradient brand tokens as app/verify/[id]/page.tsx — this page
// is the same kind of one-off, publicly-linked "official document" view.
const STYLES = `
  .tsv-root {
    --tsv-bg: #08080a;
    --tsv-surface: #18181c;
    --tsv-border: rgba(255, 255, 255, 0.06);
    --tsv-gold: #f5a623;
    --tsv-orange: #e8621a;
    --tsv-red: #c0392b;
    --tsv-grad: linear-gradient(135deg, #f5a623 0%, #e8621a 50%, #c0392b 100%);
    --tsv-grad-t: linear-gradient(90deg, #f5a623, #e8621a, #c0392b);
    --tsv-text: #f0efe8;
    --tsv-muted: #9e9b92;
    --tsv-r: 14px;

    background: var(--tsv-bg);
    color: var(--tsv-text);
    font-family: "Outfit", sans-serif;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .tsv-root * { box-sizing: border-box; }

  .tsv-wrapper {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  .tsv-card {
    width: 100%;
    max-width: 520px;
    background: rgba(24, 24, 28, 0.9);
    border: 1px solid var(--tsv-border);
    border-radius: 28px;
    padding: 48px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 20px 80px rgba(0, 0, 0, 0.55);
  }
  .tsv-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--tsv-grad);
  }

  .tsv-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(245, 166, 35, 0.08);
    border: 1px solid rgba(245, 166, 35, 0.18);
    color: var(--tsv-gold);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 8px 18px;
    border-radius: 100px;
    margin-bottom: 24px;
  }

  .tsv-title {
    font-size: clamp(28px, 5vw, 38px);
    line-height: 1.1;
    font-weight: 900;
    letter-spacing: -1px;
    margin-bottom: 14px;
  }

  .tsv-subtitle {
    color: var(--tsv-muted);
    font-size: 14px;
    line-height: 1.8;
    font-weight: 300;
    margin-bottom: 32px;
  }

  .tsv-password-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--tsv-border);
    border-radius: var(--tsv-r);
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 24px;
  }
  .tsv-password {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 20px;
    letter-spacing: 1px;
    word-break: break-all;
  }

  .tsv-footer-note {
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;
    line-height: 1.7;
  }
`;

export default async function CredentialsViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await consumeCredentialLink(token);

  return (
    <div className={`tsv-root ${outfit.className}`}>
      <style>{STYLES}</style>
      <div className="tsv-wrapper">
        <div className="tsv-card">
          <div className="tsv-badge">
            <KeyRound size={13} />
            One-Time Access
          </div>

          {result.ok ? (
            <>
              <h1 className="tsv-title">Your password</h1>
              <p className="tsv-subtitle">
                This is the only time this password will be shown. Copy it now and store it
                somewhere safe — this link won&apos;t work again.
              </p>
              <div className="tsv-password-box">
                <span className="tsv-password">{result.password}</span>
                <CopyPasswordButton password={result.password} />
              </div>
              <p className="tsv-footer-note">
                If you didn&apos;t request this account, contact your administrator immediately.
              </p>
            </>
          ) : (
            <>
              <h1 className="tsv-title">
                {result.reason === "expired" ? "Link expired" : "Already viewed"}
              </h1>
              <p className="tsv-subtitle">
                {result.reason === "not_found" &&
                  "This link isn't valid. Double-check the URL, or ask your administrator to resend it."}
                {result.reason === "expired" &&
                  "This link has expired. Ask your administrator to send a new one."}
                {result.reason === "used" &&
                  "This password has already been viewed once and can't be shown again. Ask your administrator to reset it if you need access."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
