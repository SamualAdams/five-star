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
  const [reviewUrl, setReviewUrl] = useState("");
  const [isEditingReviewUrl, setIsEditingReviewUrl] = useState(false);

  // Review links state
  const [reviewLinks, setReviewLinks] = useState([]);
  const [newPlatform, setNewPlatform] = useState("google");
  const [newUrl, setNewUrl] = useState("");
  const [reviewLinksError, setReviewLinksError] = useState("");

  const isAdmin = org?.role === "admin";

  useEffect(() => {
    loadOrg();
  }, [id]);

  async function loadOrg() {
    try {
      const data = await getOrganization(token, id);
      setOrg(data);
      setEditName(data.name);
setReviewLinks(data.review_links || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddReviewLink(e) {
    e.preventDefault();
    setReviewLinksError("");
    const alreadyAdded = reviewLinks.some((l) => l.platform === newPlatform);
    if (alreadyAdded) {
      setReviewLinksError(`A ${PLATFORM_LABELS[newPlatform]} link already exists. Remove it first.`);
      return;
    }
    const updated = [...reviewLinks, { platform: newPlatform, url: newUrl.trim() }];
    try {
      const result = await updateOrgReviewLinks(token, id, updated);
      setReviewLinks(result.review_links || []);
      setNewUrl("");
    } catch (err) {
      setReviewLinksError(err.message);
    }
  }

  async function handleRemoveReviewLink(platform) {
    setReviewLinksError("");
    const updated = reviewLinks.filter((l) => l.platform !== platform);
    try {
      const result = await updateOrgReviewLinks(token, id, updated);
      setReviewLinks(result.review_links || []);
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
          </p>

          {reviewLinks.length > 0 && (
            <ul className="review-links-list">
              {reviewLinks.map((link) => (
                <li key={link.platform} className="review-link-item">
                  <span className="review-link-platform">{PLATFORM_LABELS[link.platform]}</span>
                  <span className="review-link-url">{link.url}</span>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => handleRemoveReviewLink(link.platform)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {reviewLinks.length < PLATFORMS.length && (
            <form className="review-link-form" onSubmit={handleAddReviewLink}>
              <select
                className="field-select"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
              >
                {PLATFORMS.filter((p) => !reviewLinks.some((l) => l.platform === p)).map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
              <input
                className="field-input"
                type="url"
                placeholder="https://g.page/your-business/review"
value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                required
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={!newUrl.trim()}>
                Add
              </button>
            </form>
          )}

          {reviewLinksError && <p className="message message--error">{reviewLinksError}</p>}
        </div>
      )}

      <MemberList token={token} orgId={Number(id)} currentUserId={user.id} isAdmin={isAdmin} />
      <InviteList token={token} orgId={Number(id)} isAdmin={isAdmin} />
    </div>
  );
}
