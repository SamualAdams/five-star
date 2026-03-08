import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listDigests } from "../api";

function DigestSection({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <p
        style={{
          margin: "0 0 0.4rem",
          fontWeight: 700,
          fontSize: "0.82rem",
          color: "#5e6770",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
        {items.map((item, i) => (
          <li key={i} style={{ lineHeight: 1.6, marginBottom: "0.25rem" }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DigestCard({ digest }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: "1px solid #d6dfe6",
        borderRadius: "12px",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.9rem 1rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "inline-block",
              padding: "0.15rem 0.55rem",
              borderRadius: "6px",
              fontSize: "0.78rem",
              fontWeight: 700,
              flexShrink: 0,
              background: "#e0f7ea",
              color: "#1a7a3a",
            }}
          >
            Published
          </span>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "#2d1b42",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {digest.period_start === digest.period_end
              ? digest.period_start
              : `${digest.period_start} → ${digest.period_end}`}
          </span>
          <span style={{ fontSize: "0.82rem", color: "#5e6770", flexShrink: 0 }}>
            {digest.feedback_count} submission{digest.feedback_count !== 1 ? "s" : ""}
          </span>
        </div>
        <span style={{ color: "#5e6770", fontSize: "0.8rem", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 1rem 1rem" }}>
          <div style={{ borderTop: "1px solid #f0f3f6", paddingTop: "1rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <p
                style={{
                  margin: "0 0 0.4rem",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  color: "#5e6770",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Summary
              </p>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{digest.summary}</p>
            </div>
            <DigestSection label="Insights" items={digest.insights} />
            <DigestSection label="Immediate Actions" items={digest.immediate_actions} />
            <DigestSection label="Long-Term Goals" items={digest.long_term_goals} />

            {digest.published_at && (
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#5e6770" }}>
                Published {new Date(digest.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DigestsPage({ token, orgId: orgIdProp }) {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const orgId = orgIdProp ?? Number(paramId);

  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await listDigests(token, orgId);
        // Only show published ones (backend already filters for non-admins,
        // but we filter client-side too in case this page is reused)
        setDigests(data.filter((d) => d.status === "published"));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  return (
    <div className="settings-page">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => navigate(-1)}
      >
        &larr; Back
      </button>

      <div className="settings-section">
        <h2 className="settings-title">Org Digests</h2>
        <p className="settings-meta">
          Published feedback summaries shared by your organization&apos;s admins.
        </p>
      </div>

      {loading && <p className="settings-meta">Loading…</p>}
      {error && <p className="message message--error">{error}</p>}

      {!loading && !error && digests.length === 0 && (
        <p className="settings-meta">No digests have been published yet.</p>
      )}

      {digests.length > 0 && (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {digests.map((d) => (
            <DigestCard key={d.id} digest={d} />
          ))}
        </div>
      )}
    </div>
  );
}
