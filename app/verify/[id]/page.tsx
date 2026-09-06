import { Outfit } from "next/font/google";
import { ArrowLeft } from "lucide-react";

import { formatInvoiceNumber } from "@/lib/invoices/constants";
import { getInvoiceForVerification } from "@/actions/invoices/queries";
import { VerifyCursor } from "./verify-cursor";

export const dynamic = "force-dynamic";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

// Ports the live techstersol.com invoice-verification template
// (Techstersol/invoices/*.html + assets/css/style.css) as-is — same tokens,
// same markup, same fonts — so this page matches the public site exactly.
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
    --tsv-muted: #6a6860;
    --tsv-muted2: #9e9b92;
    --tsv-r: 14px;
    --tsv-ease: cubic-bezier(0.16, 1, 0.3, 1);

    background: var(--tsv-bg);
    color: var(--tsv-text);
    font-family: "Outfit", sans-serif;
    font-weight: 400;
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    cursor: none;
  }
  .tsv-root * { box-sizing: border-box; }
  .tsv-root a { text-decoration: none !important; color: inherit; }

  .tsv-grain {
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 1;
    opacity: 0.35;
  }

  #tsv-cursor {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--tsv-orange);
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 99999;
    transform: translate(-50%, -50%);
    transition: width 0.2s, height 0.2s, background 0.2s;
    mix-blend-mode: difference;
  }
  #tsv-cursor-ring {
    width: 36px;
    height: 36px;
    border: 1px solid rgba(232, 98, 26, 0.5);
    border-radius: 50%;
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 99998;
    transform: translate(-50%, -50%);
    transition: width 0.35s var(--tsv-ease), height 0.35s var(--tsv-ease);
  }

  .tsv-wrapper {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    position: relative;
    z-index: 2;
  }

  .tsv-card {
    width: 100%;
    max-width: 820px;
    background: rgba(24, 24, 28, 0.9);
    border: 1px solid var(--tsv-border);
    border-radius: 28px;
    padding: 55px;
    backdrop-filter: blur(18px);
    position: relative;
    overflow: hidden;
    box-shadow: 0 20px 80px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }
  .tsv-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
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
    margin-bottom: 28px;
  }
  .tsv-badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tsv-gold);
    box-shadow: 0 0 12px var(--tsv-gold);
  }

  .tsv-title {
    font-family: "Outfit", sans-serif;
    font-size: clamp(36px, 5vw, 62px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -2px;
    margin-bottom: 14px;
  }
  .tsv-title span {
    background: var(--tsv-grad-t);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tsv-subtitle {
    color: var(--tsv-muted);
    font-size: 15px;
    line-height: 1.8;
    font-weight: 300;
    margin-bottom: 42px;
    max-width: 580px;
  }

  .tsv-verify-box {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--tsv-border);
    border-radius: var(--tsv-r);
    overflow: hidden;
  }
  .tsv-verify-head {
    display: grid;
    grid-template-columns: 1fr 2fr;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--tsv-border);
  }
  .tsv-verify-head div {
    padding: 18px 24px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--tsv-orange);
  }
  .tsv-verify-row {
    display: grid;
    grid-template-columns: 1fr 2fr;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: 0.3s var(--tsv-ease);
  }
  .tsv-verify-row:last-child { border-bottom: none; }
  .tsv-verify-label,
  .tsv-verify-value {
    padding: 20px 24px;
  }
  .tsv-verify-label {
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }
  .tsv-verify-value {
    color: var(--tsv-muted);
    font-size: 14px;
    line-height: 1.8;
    font-weight: 300;
  }

  .tsv-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(46, 204, 113, 0.08);
    border: 1px solid rgba(46, 204, 113, 0.2);
    color: #2ecc71;
    padding: 8px 14px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .tsv-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #2ecc71;
    box-shadow: 0 0 12px #2ecc71;
  }
  .tsv-status--unpaid {
    background: rgba(245, 166, 35, 0.08);
    border-color: rgba(245, 166, 35, 0.2);
    color: var(--tsv-gold);
  }
  .tsv-status--unpaid .tsv-status-dot {
    background: var(--tsv-gold);
    box-shadow: 0 0 12px var(--tsv-gold);
  }
  .tsv-status--bottom { margin-top: 35px; }

  .tsv-footer-note {
    margin-top: 24px;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;
    line-height: 1.7;
  }

  .tsv-btn-grad {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    background: var(--tsv-grad);
    color: #fff !important;
    font-weight: 700;
    font-size: 15px;
    font-family: "Outfit", sans-serif;
    padding: 14px 28px;
    border-radius: 100px;
    transition: transform 0.25s var(--tsv-ease), box-shadow 0.25s;
    position: relative;
    overflow: hidden;
    border: none;
    cursor: none;
    margin-top: 32px;
  }
  .tsv-btn-grad:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 40px rgba(232, 98, 26, 0.45);
  }

  @media (max-width: 768px) {
    .tsv-card { padding: 32px 22px; }
    .tsv-verify-head,
    .tsv-verify-row { grid-template-columns: 1fr; }
    .tsv-verify-label {
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      padding-bottom: 10px;
    }
    .tsv-verify-value { padding-top: 12px; }
  }
`;

export default async function VerifyInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceForVerification(id);
  const isPaid = invoice?.status === "PAID";

  return (
    <div className={`tsv-root ${outfit.className}`}>
      <style>{STYLES}</style>

      <div className="tsv-grain" />
      <VerifyCursor />

      <div className="tsv-wrapper">
        <div className="tsv-card">
          <div className="tsv-badge">
            <span className="tsv-badge-dot" />
            E-Invoice Verification
          </div>

          <h1 className="tsv-title">
            Digital <span>Invoice</span> Verification
          </h1>

          <p className="tsv-subtitle">
            This page verifies the authenticity and assignment details of the
            issued invoice.
          </p>

          {!invoice ? (
            <>
              <div className="tsv-verify-box">
                <div className="tsv-verify-row">
                  <div className="tsv-verify-label">Result</div>
                  <div className="tsv-verify-value">
                    No invoice matches this verification link.
                  </div>
                </div>
              </div>
              <p className="tsv-footer-note">
                If you believe this is an error, contact Techstersol directly.
              </p>
            </>
          ) : (
            <>
              <div className="tsv-verify-box">
                <div className="tsv-verify-head">
                  <div>Field</div>
                  <div>Details</div>
                </div>

                <Row
                  label="Invoice No."
                  value={formatInvoiceNumber(invoice.number)}
                />
                <Row label="Client Name" value={invoice.clientName} />
                <Row label="Task" value={invoice.task || "—"} />
                <Row
                  label="Status"
                  value={
                    <span
                      className={
                        "tsv-status" + (isPaid ? "" : " tsv-status--unpaid")
                      }
                    >
                      <span className="tsv-status-dot" />
                      {isPaid ? "Paid" : "Unpaid"}
                    </span>
                  }
                />
                <Row
                  label="Invoice Date"
                  value={formatDate(invoice.issueDate)}
                />
                <Row label="Due Date" value={formatDate(invoice.dueDate)} />
                {isPaid && invoice.paidOn && (
                  <>
                    <Row
                      label="Payment Date"
                      value={formatDate(invoice.paidOn)}
                    />
                    <Row
                      label="Paid On"
                      value={`${invoice.bankName} (${invoice.currency})`}
                    />
                    <Row
                      label="Transaction ID"
                      value={invoice.transactionId ?? "—"}
                    />
                  </>
                )}
              </div>

              <div className="tsv-status tsv-status--bottom">
                <span className="tsv-status-dot" />
                VERIFIED INVOICE
              </div>

              <p className="tsv-footer-note">
                Verification generated by Techstersol. Any modification to the
                invoice invalidates this verification reference.
              </p>
            </>
          )}

          <div>
            <a href="https://www.techstersol.com" className="tsv-btn-grad">
              <ArrowLeft size={16} />
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="tsv-verify-row">
      <div className="tsv-verify-label">{label}</div>
      <div className="tsv-verify-value">{value}</div>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
