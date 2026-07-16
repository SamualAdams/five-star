import { DEMO_DIGEST, DEMO_ORG } from "./demoData";

export const DIGEST_FORMATS = [
  { id: "full", label: "Full report" },
  { id: "bullets", label: "Quick bullets" },
  { id: "actions", label: "Action plan" },
  { id: "summary", label: "Summary only" },
  { id: "email", label: "Team email" },
];

function Section({ label, children }) {
  return (
    <div>
      <p className="demo-digest-label">{label}</p>
      {children}
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="demo-digest-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function DemoDigestView({ format = "full" }) {
  const digest = DEMO_DIGEST;

  if (format === "bullets") {
    return (
      <div className="demo-digest-view">
        <Section label="Insights">
          <BulletList items={digest.insights} />
        </Section>
      </div>
    );
  }

  if (format === "actions") {
    return (
      <div className="demo-digest-view">
        <Section label="This week">
          <ul className="demo-check-list">
            {digest.immediate_actions.map((item, i) => (
              <li key={i}>
                <span className="demo-check-box" aria-hidden="true">☐</span> {item}
              </li>
            ))}
          </ul>
        </Section>
        <Section label="Later">
          <ul className="demo-check-list">
            {digest.long_term_goals.map((item, i) => (
              <li key={i}>
                <span className="demo-check-box" aria-hidden="true">☐</span> {item}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    );
  }

  if (format === "summary") {
    return (
      <div className="demo-digest-view">
        <p className="demo-digest-summary-only">{digest.summary}</p>
      </div>
    );
  }

  if (format === "email") {
    return (
      <div className="demo-email-preview">
        <div className="demo-email-head">
          <p><strong>Subject:</strong> Weekly feedback digest — {DEMO_ORG.name}</p>
          <p><strong>To:</strong> Everyone at {DEMO_ORG.name}</p>
        </div>
        <div className="demo-email-body">
          <p>Hi team,</p>
          <p>
            Here&apos;s what our customers told us over the last 30 days
            ({digest.feedback_count} submissions):
          </p>
          <p>{digest.summary}</p>
          <p><strong>Top 3 actions this week:</strong></p>
          <ol>
            {digest.immediate_actions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
          <p>— sent with five*</p>
        </div>
      </div>
    );
  }

  // "full" — mirrors the real DigestViewer structure
  return (
    <div className="demo-digest-view">
      <Section label="Summary">
        <p className="demo-digest-summary">{digest.summary}</p>
      </Section>
      <Section label="Insights">
        <BulletList items={digest.insights} />
      </Section>
      <Section label="Immediate Actions">
        <BulletList items={digest.immediate_actions} />
      </Section>
      <Section label="Long-Term Goals">
        <BulletList items={digest.long_term_goals} />
      </Section>
    </div>
  );
}
