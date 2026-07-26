/* BrandedText preview cells.

   BrandedText takes a plain string and swaps every literal "five*" for a real
   <BrandName />. It exists so brand copy can live in data — arrays of steps,
   CMS strings, anything not authored as JSX — and still render the wordmark
   correctly. The stories are therefore about the INPUT string, not props.
   The copy is verbatim from the marketing page's own content arrays. */

import { BrandedText } from "five-star-frontend";

const copy = {
  margin: 0,
  maxWidth: "34rem",
  fontFamily: "var(--font-sans)",
  fontSize: "1.05rem",
  lineHeight: 1.75,
  color: "var(--color-muted)",
};

export function InlineInCopy() {
  return (
    <p style={copy}>
      <BrandedText>
        five* converts those submissions into an insight-driven report with a summary, clear themes,
        and practical next steps.
      </BrandedText>
    </p>
  );
}

export function SeveralMentions() {
  return (
    <p style={copy}>
      <BrandedText>
        A five* link goes on the counter. What customers leave there stays private, and five* turns
        it into the report you read on Monday.
      </BrandedText>
    </p>
  );
}

export function NoMention() {
  return (
    <p style={copy}>
      <BrandedText>
        Copy with no brand token passes through untouched — safe to wrap every string in a content
        array.
      </BrandedText>
    </p>
  );
}

export function FromDataArray() {
  const steps = [
    "Share your five* link wherever customers already are.",
    "They answer in under a minute, privately.",
    "five* groups the answers into themes you can act on.",
  ];

  return (
    <ol style={{ ...copy, paddingLeft: "1.25rem", display: "grid", gap: "0.6rem" }}>
      {steps.map((step) => (
        <li key={step}>
          <BrandedText>{step}</BrandedText>
        </li>
      ))}
    </ol>
  );
}
