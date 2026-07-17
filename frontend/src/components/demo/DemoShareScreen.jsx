import { useState } from "react";
import DemoDigestView from "./DemoDigestView";
import { DEMO_DIGEST, DEMO_MEMBERS, DEMO_ORG } from "./demoData";

export default function DemoShareScreen({ published, onPublish }) {
  const [isPublishing, setIsPublishing] = useState(false);

  function handlePublish() {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      onPublish();
    }, 700);
  }

  return (
    <div className="demo-screen demo-screen--wide">
      <div className="demo-dash-header">
        <h2 className="demo-dash-title">{DEMO_ORG.name}</h2>
        <span className="demo-owner-pill">Owner view</span>
      </div>

      <div className="demo-dash-panel">
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
            <p className="demo-digest-label">Summary</p>
            <p className="demo-digest-summary">{DEMO_DIGEST.summary}</p>
            {!published && (
              <div className="demo-share-row">
                <button
                  type="button"
                  className="btn btn--sm demo-btn-share"
                  onClick={handlePublish}
                  disabled={isPublishing}
                >
                  {isPublishing ? "Publishing…" : "Share with Organization"}
                </button>
                <p className="demo-note">Publishing makes the report visible to everyone on your team.</p>
              </div>
            )}
          </div>
        </div>

        {published && (
          <div className="demo-team-panel">
            <h3 className="demo-dash-heading">What your team sees</h3>
            <p className="demo-dash-meta">
              Everyone at {DEMO_ORG.name} now sees the same published report — same priorities, no forwarding screenshots.
            </p>

            <div className="demo-table-scroll">
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_MEMBERS.map((m) => (
                    <tr key={m.email} className={m.isSelf ? "members-row--self" : ""}>
                      <td>
                        {m.email}
                        {m.isSelf && <span className="demo-recent-badge">you</span>}
                      </td>
                      <td>{m.role}</td>
                      <td>{m.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="demo-share-finale">
              That&apos;s the whole loop — a customer spoke up, and your whole team knows what to do next.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
