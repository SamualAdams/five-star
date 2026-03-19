import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteOrganization, getOrganization, updateOrganization, updateOrgReviewLinks } from "../api";
import InviteList from "./InviteList";
import MemberList from "./MemberList";

const PLATFORM_LABELS = { google: "Google Reviews", yelp: "Yelp", tripadvisor: "TripAdvisor" };
const PLATFORMS = Object.keys(PLATFORM_LABELS);

export default function OrgSettingsPage({ token, user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [editName, setEditName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [feedbackUrlCopied, setFeedbackUrlCopied] = useState(false);

  // Review links state: one URL per platform, edited all at once
  const [linkInputs, setLinkInputs] = useState({ google: "", yelp: "", tripadvisor: "" });
  const [reviewLinksError, setReviewLinksError] = useState("");
  const [reviewLinksSaved, setReviewLinksSaved] = useState(false);

  const isAdmin = org?.role === "admin";

  useEffect(() => {
    loadOrg();
  }, [id]);

  async function loadOrg() {
    try {
      const data = await getOrganization(token, id);
      setOrg(data);
      setEditName(data.name);
      const inputs = { google: "", yelp: "", tripadvisor: "" };
      for (const link of data.review_links || []) {
        if (link.platform in inputs) inputs[link.platform] = link.url;
      }
      setLinkInputs(inputs);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveReviewLinks(e) {
    e.preventDefault();
    setReviewLinksError("");
    setReviewLinksSaved(false);
    const updated = PLATFORMS
      .filter((p) => linkInputs[p].trim())
      .map((p) => ({ platform: p, url: linkInputs[p].trim() }));
    try {
      await updateOrgReviewLinks(token, id, updated);
      setReviewLinksSaved(true);
      setTimeout(() => setReviewLinksSaved(false), 2000);
    } catch (err) {
      setReviewLinksError(err.message);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    setError("");
    try {
      const updated = await updateOrganization(token, id, { name: editName });
      setOrg(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    try {
      await deleteOrganization(token, id);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!org) {
    return (
      <div className="settings-page">
        {error ? <p className="message message--error">{error}</p> : <p>Loading...</p>}
      </div>
    );
  }

  return (
    <div className="settings-page">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate("/dashboard")}>
        ← Back to dashboard
      </button>

      <div className="settings-section">
        <h2 className="settings-title">{org.name}</h2>
        <p className="settings-meta">
          Your role: <strong>{org.role}</strong>
        </p>

        {error && <p className="message message--error">{error}</p>}

        {isAdmin && (
          <div className="settings-actions">
            {isEditing ? (
              <form className="inline-form" onSubmit={handleRename}>
                <input
                  className="field-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  minLength={1}
                  maxLength={255}
                  required
                />
                <button type="submit" className="btn btn--primary btn--sm">
                  Save
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(true)}>
                Rename
              </button>
            )}
            <button type="button" className="btn btn--danger btn--sm" onClick={handleDelete}>
              Delete organization
            </button>
          </div>
        )}
      </div>

      {isAdmin && org.feedback_token && (
        <div className="settings-section">
          <h3 className="settings-heading">Public Feedback URL</h3>
          <p className="settings-meta">Share this link to receive anonymous feedback:</p>
          <div className="url-display">
            <input
              className="url-input"
              type="text"
              readOnly
              value={`${window.location.origin}/feedback/${org.feedback_token}`}
            />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/feedback/${org.feedback_token}`);
                  setFeedbackUrlCopied(true);
                  setTimeout(() => setFeedbackUrlCopied(false), 2000);
                } catch {
                  setError("Failed to copy");
                }
              }}
            >
              {feedbackUrlCopied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="settings-section">
          <h3 className="settings-heading">Public Review Links</h3>
          <p className="settings-meta">
            After submitting feedback, customers will see links to leave a public review on these platforms.
            Leave a field blank to omit that platform.
          </p>
          <form className="review-links-form" onSubmit={handleSaveReviewLinks}>
            {PLATFORMS.map((p) => (
              <div key={p} className="review-link-row">
                <label className="review-link-label">{PLATFORM_LABELS[p]}</label>
                <input
                  className="field-input"
                  type="url"
                  placeholder={p === "google" ? "https://g.page/your-business/review" : p === "yelp" ? "https://yelp.com/biz/your-business" : "https://tripadvisor.com/your-listing"}
                  value={linkInputs[p]}
                  onChange={(e) => setLinkInputs((prev) => ({ ...prev, [p]: e.target.value }))}
                />
              </div>
            ))}
            {reviewLinksError && <p className="message message--error">{reviewLinksError}</p>}
            <button type="submit" className="btn btn--primary btn--sm">
              {reviewLinksSaved ? "Saved!" : "Save"}
            </button>
          </form>
        </div>
      )}

      <MemberList token={token} orgId={Number(id)} currentUserId={user.id} isAdmin={isAdmin} />
      <InviteList token={token} orgId={Number(id)} isAdmin={isAdmin} />
    </div>
  );
}
