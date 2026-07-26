/* BrandName preview cells.

   BrandName has no visual props of its own — it is `color: inherit` and
   `font: inherit`, and the asterisk is sized in `em`. So the only useful
   stories are CONTEXTS: the same component dropped into different type and
   colour surroundings, proving the mark tracks whatever it is placed in.
   The running-text and kicker cells are the real compositions from
   MarketingPage.jsx. */

import { BrandName } from "five-star-frontend";

const sans = { fontFamily: "var(--font-sans)", color: "var(--color-text)" };

export function Wordmark() {
  return (
    <div style={{ ...sans, display: "flex", alignItems: "baseline", gap: "2.5rem" }}>
      <span style={{ fontSize: "3rem", fontWeight: 800, color: "var(--color-ink)" }}>
        <BrandName />
      </span>
      <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-ink)" }}>
        <BrandName />
      </span>
      <span style={{ fontSize: "0.83rem", fontWeight: 800, color: "var(--color-ink)" }}>
        <BrandName />
      </span>
    </div>
  );
}

export function InRunningText() {
  return (
    <p style={{ ...sans, margin: 0, maxWidth: "32rem", fontSize: "1.05rem", lineHeight: 1.75 }}>
      Customers rarely tell you what is working — and what isn&apos;t.{" "}
      <strong style={{ color: "var(--color-ink)" }}>
        <BrandName />
      </strong>{" "}
      helps you see the patterns in what they actually say.
    </p>
  );
}

export function SectionKicker() {
  return (
    <p className="section-kicker" style={{ margin: 0, fontFamily: "var(--font-sans)" }}>
      Why <BrandName />
    </p>
  );
}

export function OnDarkSurface() {
  return (
    <div
      style={{
        background: "var(--color-ink)",
        color: "var(--color-on-dark)",
        padding: "2rem 2.25rem",
        borderRadius: "var(--radius-panel)",
        fontFamily: "var(--font-sans)",
        fontSize: "1.75rem",
        fontWeight: 800,
      }}
    >
      <BrandName />
    </div>
  );
}
