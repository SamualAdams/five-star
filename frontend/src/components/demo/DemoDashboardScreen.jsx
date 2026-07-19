import { useState } from "react";
import SubmissionsChart from "../SubmissionsChart";
import DemoDigestView, { DIGEST_FORMATS } from "./DemoDigestView";
import { DEMO_ORG, DEMO_DIGEST, DEMO_FEEDBACK_ENTRIES, DEMO_PREFILLED_REVIEW, demoStats } from "./demoData";

const STATS = demoStats(30);
const STATS_TOTAL = STATS.reduce((sum, d) => sum + d.count, 0);

export function DemoDigestCard({ published = false, format = "full", children }) {
  return (
    <div className="demo-digest-card">
      <div className="demo-digest-head">
        <span className={`demo-badge ${published ? "demo-badge--published" : "demo-badge--draft"}`}>
          {published ? "Published" : "Draft"}
        </span>
        <span className="demo-digest-period">
          {DEMO_DIGEST.period_start} → {DEMO_DIGEST.period_end}
        </span>
        <span className="demo-digest-count">{DEMO_DIGEST.feedback_count} submissions</span>
      </div>
      <div className="demo-digest-body">
        {children}
        <DemoDigestView format={format} />
      </div>
    </div>
  );
}

export default function DemoDashboardScreen({ focus, digestGenerated, onGenerated, format, onFormatChange }) {
  const [isGenerating, setIsGenerating] = useState(false);

  function handleGenerate() {
    setIsGenerating(true);
    // Simulated AI — the digest is pre-written, no API call.
    setTimeout(() => {
      setIsGenerating(false);
      onGenerated();
    }, 1200);
  }

  const showFormats = focus === "formats";

  return (
    <div className="demo-screen demo-screen--wide">
      <div className="demo-dash-header">
        <h2 className="demo-dash-title">{DEMO_ORG.name}</h2>
        <span className="demo-owner-pill">Owner view</span>
      </div>

      <div className="demo-dash-panel">
        <h3 className="demo-dash-heading">Feedback Reports</h3>
        <p className="demo-dash-meta">
          Summarize feedback into a structured report and share it with your organization.
        </p>

        <div className="demo-horizon-row">
          <span className="demo-horizon-pill">Last month</span>
        </div>

        <SubmissionsChart data={STATS} days={30} total={STATS_TOTAL} height={110} />

        {!showFormats && (
          <div className="demo-recent-list">
            <p className="demo-digest-label">Recent submissions</p>
            <div className="demo-recent-item demo-recent-item--yours">
              <p>{DEMO_PREFILLED_REVIEW.text}</p>
              <p className="demo-recent-meta">
                just now · {DEMO_PREFILLED_REVIEW.name} <span className="demo-recent-badge">that&apos;s yours</span>
              </p>
            </div>
            {DEMO_FEEDBACK_ENTRIES.slice(0, 2).map((entry) => (
              <div className="demo-recent-item" key={entry.content}>
                <p>{entry.content}</p>
                <p className="demo-recent-meta">{entry.meta}</p>
              </div>
            ))}
          </div>
        )}

        {!digestGenerated ? (
          <div className="demo-generate-row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating report…" : "Generate Report for last month"}
            </button>
            {isGenerating && (
              <p className="demo-dash-meta">
                This may take a few seconds while the AI processes your feedback…
              </p>
            )}
          </div>
        ) : (
          <DemoDigestCard format={showFormats ? format : "full"}>
            {showFormats && (
              <div className="demo-format-pills">
                {DIGEST_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`demo-format-pill ${format === f.id ? "demo-format-pill--active" : ""}`}
                    onClick={() => onFormatChange(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </DemoDigestCard>
        )}

      </div>
    </div>
  );
}
