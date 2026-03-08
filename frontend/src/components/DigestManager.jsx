import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  deleteDigest,
  generateDigest,
  getFeedbackStats,
  listDigests,
  publishDigest,
  updateDigest,
} from "../api";

const HORIZONS = [
  { label: "Last day", days: 1 },
  { label: "Last 3 days", days: 3 },
  { label: "Last 7 days", days: 7 },
  { label: "Last month", days: 30 },
  { label: "Last quarter", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last year", days: 365 },
];

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatChartDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  if (days <= 7) return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (days <= 90) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

// ─── ListEditor ─────────────────────────────────────────────────────────────

function ListEditor({ label, items, onChange }) {
  function update(idx, val) {
    const next = [...items];
    next[idx] = val;
    onChange(next);
  }
  function remove(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...items, ""]);
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "0.88rem", color: "#4f5a66" }}>
        {label}
      </p>
      <div style={{ display: "grid", gap: "0.4rem" }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input
              className="field-input"
              style={{ marginBottom: 0, flex: 1 }}
              value={item}
              onChange={(e) => update(idx, e.target.value)}
              placeholder={`Item ${idx + 1}`}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => remove(idx)}
              style={{ flexShrink: 0 }}
              aria-label="Remove item"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn--ghost btn--sm" onClick={add} style={{ marginTop: "0.4rem" }}>
        + Add item
      </button>
    </div>
  );
}

// ─── DigestViewer ────────────────────────────────────────────────────────────

function DigestViewer({ digest }) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <p style={{ margin: "0 0 0.3rem", fontWeight: 700, fontSize: "0.88rem", color: "#4f5a66", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Summary
        </p>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{digest.summary}</p>
      </div>

      {[
        { key: "insights", label: "Insights" },
        { key: "immediate_actions", label: "Immediate Actions" },
        { key: "long_term_goals", label: "Long-Term Goals" },
      ].map(({ key, label }) => (
        <div key={key}>
          <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "0.88rem", color: "#4f5a66", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {label}
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {digest[key].map((item, i) => (
              <li key={i} style={{ lineHeight: 1.6, marginBottom: "0.25rem" }}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── DigestEditor ─────────────────────────────────────────────────────────────

function DigestEditor({ digest, token, orgId, onSaved, onPublished, onCancel }) {
  const [summary, setSummary] = useState(digest.summary);
  const [insights, setInsights] = useState([...digest.insights]);
  const [immediateActions, setImmediateActions] = useState([...digest.immediate_actions]);
  const [longTermGoals, setLongTermGoals] = useState([...digest.long_term_goals]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      const updated = await updateDigest(token, orgId, digest.id, {
        summary,
        insights,
        immediate_actions: immediateActions,
        long_term_goals: longTermGoals,
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!window.confirm("Share this digest with all org members? This cannot be undone.")) return;
    setIsPublishing(true);
    setError("");
    try {
      const updated = await publishDigest(token, orgId, digest.id);
      onPublished(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      {error && <p className="message message--error">{error}</p>}

      <div>
        <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "0.88rem", color: "#4f5a66", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Summary
        </p>
        <textarea
          className="field-textarea"
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <ListEditor label="Insights" items={insights} onChange={setInsights} />
      <ListEditor label="Immediate Actions" items={immediateActions} onChange={setImmediateActions} />
      <ListEditor label="Long-Term Goals" items={longTermGoals} onChange={setLongTermGoals} />

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={isSaving || isPublishing}
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={handlePublish}
          disabled={isSaving || isPublishing}
          style={{ background: "#1a7a3a", color: "#fff", border: "1px solid transparent" }}
        >
          {isPublishing ? "Publishing…" : "Share with Organization"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onCancel}
          disabled={isSaving || isPublishing}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── DigestCard ───────────────────────────────────────────────────────────────

function DigestCard({ digest, token, orgId, isAdmin, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isDraft = digest.status === "draft";

  async function handleDelete() {
    if (!window.confirm("Delete this digest? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteDigest(token, orgId, digest.id);
      onDelete(digest.id);
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #d6dfe6",
        borderRadius: "12px",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); if (editing) setEditing(false); }}
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
              background: isDraft ? "#fff3cd" : "#e0f7ea",
              color: isDraft ? "#856404" : "#1a7a3a",
            }}
          >
            {isDraft ? "Draft" : "Published"}
          </span>
          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#2d1b42", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {digest.period_start === digest.period_end
              ? digest.period_start
              : `${digest.period_start} → ${digest.period_end}`}
          </span>
          <span style={{ fontSize: "0.82rem", color: "#5e6770", flexShrink: 0 }}>
            {digest.feedback_count} submission{digest.feedback_count !== 1 ? "s" : ""}
          </span>
        </div>
        <span style={{ color: "#5e6770", fontSize: "0.8rem", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "0 1rem 1rem" }}>
          <div style={{ borderTop: "1px solid #f0f3f6", paddingTop: "1rem" }}>
            {editing ? (
              <DigestEditor
                digest={digest}
                token={token}
                orgId={orgId}
                onSaved={(updated) => { onUpdate(updated); setEditing(false); }}
                onPublished={(updated) => { onUpdate(updated); setEditing(false); }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <DigestViewer digest={digest} />
                {isAdmin && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
                    {isDraft && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
                        ✎ Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DigestManager (main export) ─────────────────────────────────────────────

export default function DigestManager({ token, orgId, isAdmin }) {
  const [selectedHorizon, setSelectedHorizon] = useState(HORIZONS[2]); // Last 7 days
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [digests, setDigests] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // Load chart data whenever horizon changes
  useEffect(() => {
    loadStats();
  }, [selectedHorizon]);

  // Load digests on mount
  useEffect(() => {
    loadDigests();
  }, []);

  async function loadStats() {
    setChartLoading(true);
    try {
      const result = await getFeedbackStats(token, orgId, selectedHorizon.days);
      setChartData(result.data);
    } catch {
      // silently fail chart — non-critical
    } finally {
      setChartLoading(false);
    }
  }

  async function loadDigests() {
    try {
      const data = await listDigests(token, orgId);
      setDigests(data);
    } catch {
      // silently fail
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerateError("");
    try {
      const periodEnd = todayIso();
      const periodStart = daysAgoIso(selectedHorizon.days - 1);
      const newDigest = await generateDigest(token, orgId, periodStart, periodEnd);
      setDigests((prev) => [newDigest, ...prev]);
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleUpdate(updated) {
    setDigests((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function handleDelete(digestId) {
    setDigests((prev) => prev.filter((d) => d.id !== digestId));
  }

  const totalInWindow = chartData.reduce((sum, d) => sum + d.count, 0);

  // Format chart tick labels (show fewer ticks for large horizons)
  const tickInterval = selectedHorizon.days <= 7 ? 0 : selectedHorizon.days <= 30 ? 2 : selectedHorizon.days <= 90 ? 6 : 29;

  const formattedChartData = chartData.map((d) => ({
    ...d,
    label: formatChartDate(d.date, selectedHorizon.days),
  }));

  return (
    <div className="settings-section">
      <h3 className="settings-heading">Feedback Digests</h3>
      <p className="settings-meta">
        Summarize feedback into a structured digest and share it with your organization.
      </p>

      {/* Horizon selector - pills on desktop, dropdown on mobile */}
      <div style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
        {/* Pills - visible on desktop */}
        <div className="horizon-pills" style={{ display: "flex", gap: "0.3rem" }}>
          {HORIZONS.map((h) => (
            <button
              key={h.days}
              type="button"
              onClick={() => setSelectedHorizon(h)}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: "6px",
                border: "none",
                background: selectedHorizon.days === h.days ? "var(--color-primary)" : "#e5e7eb",
                color: selectedHorizon.days === h.days ? "white" : "#6b7280",
                fontSize: "0.75rem",
                fontWeight: selectedHorizon.days === h.days ? "600" : "500",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {h.label}
            </button>
          ))}
        </div>

        {/* Dropdown - visible on mobile */}
        <select
          value={selectedHorizon.days}
          onChange={(e) => {
            const horizon = HORIZONS.find((h) => h.days === Number(e.target.value));
            if (horizon) setSelectedHorizon(horizon);
          }}
          className="horizon-select"
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.9rem",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          {HORIZONS.map((h) => (
            <option key={h.days} value={h.days}>
              {h.label}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div
        style={{
          background: "#fafcfd",
          border: "1px solid #e3eaf0",
          borderRadius: "12px",
          padding: "1rem 0.5rem 0.5rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0.75rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#5e6770", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Submissions
          </span>
          {!chartLoading && (
            <span style={{ fontSize: "0.82rem", color: "#5e6770" }}>
              {totalInWindow} total
            </span>
          )}
        </div>
        {chartLoading ? (
          <div style={{ height: 140, display: "grid", placeItems: "center", color: "#5e6770", fontSize: "0.9rem" }}>
            Loading…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={formattedChartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3eaf0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#5e6770" }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#5e6770" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #d6dfe6", fontSize: "0.88rem" }}
                labelStyle={{ fontWeight: 700, color: "#2d1b42" }}
                itemStyle={{ color: "#5a8faf" }}
                formatter={(val) => [val, "submissions"]}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#5a8faf"
                strokeWidth={2}
                dot={selectedHorizon.days <= 14 ? { r: 3, fill: "#5a8faf" } : false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Generate button */}
      {isAdmin && (
        <div style={{ marginBottom: "1.5rem" }}>
          {generateError && <p className="message message--error" style={{ marginBottom: "0.5rem" }}>{generateError}</p>}
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating digest…" : `Generate Digest for ${selectedHorizon.label.toLowerCase()}`}
          </button>
          {isGenerating && (
            <p className="settings-meta" style={{ marginTop: "0.4rem" }}>
              This may take a few seconds while the AI processes your feedback…
            </p>
          )}
        </div>
      )}

      {/* Digest list */}
      {digests.length > 0 ? (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "0.88rem", color: "#4f5a66", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {digests.length} digest{digests.length !== 1 ? "s" : ""}
          </p>
          {digests.map((d) => (
            <DigestCard
              key={d.id}
              digest={d}
              token={token}
              orgId={orgId}
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <p className="settings-meta">No digests yet. Generate one above to get started.</p>
      )}
    </div>
  );
}
