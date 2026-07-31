import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createSocialPost,
  generateSocialDrafts,
  listSocialConnections,
  listSocialPosts,
  publishSocialPost,
} from "../api";

const CHANNELS = [
  { id: "facebook", label: "Facebook", prompt: "Write a friendly community update." },
  { id: "instagram", label: "Instagram", prompt: "Write a visual-first caption with a few relevant hashtags." },
  { id: "tiktok", label: "TikTok", prompt: "Write a short, energetic hook and call to action." },
];

function platformDrafts(source) {
  const text = source.trim();
  return {
    facebook: text,
    instagram: `${text}\n\n#FiveStar #CustomerFeedback`,
    tiktok: `${text}\n\nTell us what you think 👇`,
  };
}

function postStatusLabel(status) {
  return {
    draft: "Draft",
    scheduled: "Scheduled",
    publishing: "Publishing",
    published: "Published",
    partial_failure: "Partially published",
    failed: "Failed",
  }[status] || status;
}

export default function FeedPage({ token, orgId, organizationName }) {
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({});
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0].id);
  const [publishMode, setPublishMode] = useState("now");
  const [channels, setChannels] = useState([]);
  const [imageNames, setImageNames] = useState([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wordsmithing, setWordsmithing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activePlatform = CHANNELS.find((channel) => channel.id === activeChannel) || CHANNELS[0];
  const activeDraft = drafts[activeChannel] || "";
  const connectedProviders = useMemo(
    () => new Set(
      connections
        .filter((connection) => (
          connection.connected
          && connection.status === "connected"
          && connection.publishing_enabled
        ))
        .map((connection) => connection.provider)
    ),
    [connections]
  );
  const canDraft = Boolean(message.trim());
  const canPreview = useMemo(
    () => Boolean(Object.values(drafts).some((draft) => draft.trim()) || imageNames.length || mediaUrl.trim()),
    [drafts, imageNames, mediaUrl]
  );
  const scheduledPosts = posts.filter((post) => post.status === "scheduled");
  const savedDrafts = posts.filter((post) => post.status === "draft");
  const selectedInstagramWithoutMedia = channels.includes("instagram") && !mediaUrl.trim();
  const canSave = (
    channels.length > 0
    && channels.every((channel) => drafts[channel]?.trim())
    && !selectedInstagramWithoutMedia
  );
  const canSubmit = canSave && (
    publishMode !== "schedule" || (scheduleDate && scheduleTime)
  );

  async function loadPublishingData() {
    if (!token || !orgId) return;
    setLoading(true);
    setError("");
    try {
      const [connectionData, postData] = await Promise.all([
        listSocialConnections(token, orgId),
        listSocialPosts(token, orgId),
      ]);
      setConnections(connectionData);
      setPosts(postData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPublishingData();
  }, [token, orgId]);

  function toggleChannel(channel) {
    if (!connectedProviders.has(channel)) {
      setNotice(`Connect ${CHANNELS.find((item) => item.id === channel)?.label} before selecting it.`);
      return;
    }
    setNotice("");
    setChannels((current) => (
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  }

  async function generatePlatformDrafts() {
    if (!canDraft) return;
    setWordsmithing(true);
    setError("");
    setNotice("");
    try {
      const generated = await generateSocialDrafts(token, orgId, message.trim());
      setDrafts(generated);
      setNotice(
        connectedProviders.size
          ? "AI drafts are ready. Review every version before publishing."
          : "AI drafts are ready. Connect at least one destination before publishing."
      );
    } catch {
      setDrafts(platformDrafts(message));
      setNotice("AI drafting was unavailable, so starter versions were created instead.");
    } finally {
      setChannels(CHANNELS.filter((channel) => connectedProviders.has(channel.id)).map((channel) => channel.id));
      setWordsmithing(false);
    }
  }

  function updateActiveDraft(value) {
    setDrafts((current) => ({ ...current, [activeChannel]: value }));
  }

  function resetActiveDraft() {
    setDrafts((current) => ({ ...current, [activeChannel]: message }));
  }

  async function submitPost(submitMode = publishMode) {
    const validForMode = submitMode === "draft" ? canSave : canSubmit;
    if (!validForMode || working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      let scheduledAt = null;
      if (submitMode === "schedule") {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      }
      const created = await createSocialPost(token, orgId, {
        master_caption: message.trim(),
        targets: channels.map((provider) => ({
          provider,
          content: drafts[provider].trim(),
        })),
        media_urls: mediaUrl.trim() ? [mediaUrl.trim()] : [],
        scheduled_at: scheduledAt,
      });
      const completed = submitMode === "now"
        ? await publishSocialPost(token, orgId, created.id)
        : created;
      setPosts((current) => [completed, ...current.filter((post) => post.id !== completed.id)]);
      setNotice(
        submitMode === "draft"
          ? "Draft saved."
          : submitMode === "schedule"
            ? "Post scheduled."
          : completed.status === "published"
            ? "Post published."
            : completed.status === "partial_failure"
              ? "Some destinations published; review the errors below."
              : "Publishing failed. Review the destination errors below."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="feed-page">
      <header className="portal-page-heading">
        <p className="dashboard-kicker">Publishing</p>
        <h1>Feed</h1>
        <p>Start with one idea, shape it for each platform, then publish or schedule the versions you want.</p>
      </header>

      {error && <p className="message message--error">{error}</p>}
      {notice && <p className="message message--success">{notice}</p>}

      <div className="feed-layout">
        <section className="portal-card feed-workspace">
          <div className="feed-workspace-heading">
            <div>
              <span className="status-pill status-pill--connected">Draft workspace</span>
              <h2>Create a post</h2>
              <p>Write the source caption once. Platform drafts can be edited independently.</p>
            </div>
            <span className="feed-org-label">{organizationName}</span>
          </div>

          <div className="feed-master-section">
            <label className="field-label" htmlFor="feed-message">Master caption</label>
            <textarea
              className="field-textarea feed-message"
              id="feed-message"
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share the idea, announcement, or update you want to turn into platform posts…"
              rows="6"
              value={message}
            />

            <div className="feed-media-fields">
              <label className="feed-media-picker" htmlFor="feed-media">
                <span className="feed-media-icon" aria-hidden="true">＋</span>
                <span>
                  <strong>Choose local images</strong>
                  <small>Preview only until managed media storage is enabled</small>
                </span>
                <input
                  id="feed-media"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => setImageNames(Array.from(event.target.files || []).map((file) => file.name))}
                />
              </label>
              <label className="feed-media-url">
                <span className="field-label">Hosted image URL</span>
                <input
                  className="field-input"
                  onChange={(event) => setMediaUrl(event.target.value)}
                  placeholder="https://images.example.com/post.jpg"
                  type="url"
                  value={mediaUrl}
                />
                <small>Required for Instagram publishing in this integration pass.</small>
              </label>
            </div>

            {imageNames.length > 0 && (
              <div className="feed-file-list" aria-label="Selected images">
                {imageNames.map((name) => <span key={name}>{name}</span>)}
              </div>
            )}

            <div className="feed-wordsmith-bar">
              <div>
                <strong>AI wordsmith</strong>
                <span>Adapt this idea for every platform, then review each version.</span>
              </div>
              <button className="btn btn--ghost btn--sm" disabled={!canDraft || wordsmithing} onClick={generatePlatformDrafts} type="button">
                {wordsmithing ? "Wordsmithing…" : "Wordsmith with AI"}
              </button>
            </div>
          </div>

          <section className="feed-drafts-section" aria-labelledby="feed-drafts-heading">
            <div className="feed-section-heading">
              <div>
                <h3 id="feed-drafts-heading">Platform drafts</h3>
                <p>Edit each version and choose one or more connected platforms.</p>
              </div>
              <span className="feed-selection-count">{channels.length} selected</span>
            </div>

            <div className="feed-draft-tabs" role="tablist" aria-label="Platform drafts">
              {CHANNELS.map((channel) => {
                const isConnected = connectedProviders.has(channel.id);
                return (
                  <button
                    aria-selected={activeChannel === channel.id}
                    className={`feed-draft-tab${activeChannel === channel.id ? " feed-draft-tab--active" : ""}${isConnected ? "" : " feed-draft-tab--unavailable"}`}
                    key={channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    role="tab"
                    type="button"
                  >
                    <span className="feed-draft-tab-mark" aria-hidden="true">{channel.label.slice(0, 1)}</span>
                    <span>{channel.label}</span>
                    <span className={`feed-draft-tab-check${channels.includes(channel.id) ? " feed-draft-tab-check--selected" : ""}`} aria-hidden="true">
                      {channels.includes(channel.id) ? "✓" : isConnected ? "+" : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="feed-draft-panel" role="tabpanel">
              <div className="feed-draft-panel-heading">
                <div>
                  <h4>{activePlatform.label} draft</h4>
                  <p>{activePlatform.prompt}</p>
                </div>
                <label className="feed-draft-include">
                  <input
                    checked={channels.includes(activeChannel)}
                    disabled={!connectedProviders.has(activeChannel)}
                    onChange={() => toggleChannel(activeChannel)}
                    type="checkbox"
                  />
                  {connectedProviders.has(activeChannel) ? "Include in publish" : "Not connected"}
                </label>
              </div>
              <textarea
                aria-label={`${activePlatform.label} draft`}
                className="field-textarea feed-platform-draft"
                onChange={(event) => updateActiveDraft(event.target.value)}
                placeholder={`Your ${activePlatform.label} draft will appear here…`}
                rows="6"
                value={activeDraft}
              />
              <div className="feed-draft-panel-footer">
                <span>{activeDraft.length} characters</span>
                <button className="btn btn--ghost btn--sm" disabled={!message.trim()} onClick={resetActiveDraft} type="button">
                  Use master caption
                </button>
              </div>
            </div>
          </section>
        </section>

        <section className="portal-card feed-publish-card">
          <div className="feed-section-heading">
            <div>
              <h3>Publish or schedule</h3>
              <p>Choose when to send the selected platform drafts.</p>
            </div>
          </div>

          <div className="feed-schedule-row">
            <div className="feed-publish-toggle" aria-label="Publishing time">
              <button
                className={publishMode === "now" ? "feed-publish-option feed-publish-option--active" : "feed-publish-option"}
                onClick={() => setPublishMode("now")}
                type="button"
              >
                Publish now
              </button>
              <button
                className={publishMode === "schedule" ? "feed-publish-option feed-publish-option--active" : "feed-publish-option"}
                onClick={() => setPublishMode("schedule")}
                type="button"
              >
                Schedule
              </button>
            </div>
            {publishMode === "schedule" && (
              <div className="feed-date-fields">
                <input
                  className="field-input"
                  aria-label="Schedule date"
                  onChange={(event) => setScheduleDate(event.target.value)}
                  type="date"
                  value={scheduleDate}
                />
                <input
                  className="field-input"
                  aria-label="Schedule time"
                  onChange={(event) => setScheduleTime(event.target.value)}
                  type="time"
                  value={scheduleTime}
                />
              </div>
            )}
          </div>

          {selectedInstagramWithoutMedia && (
            <p className="message message--error">Instagram requires a hosted image URL.</p>
          )}

          <div className="feed-composer-actions">
            <button
              className="btn btn--ghost"
              type="button"
              disabled={!canSave || working}
              onClick={() => submitPost("draft")}
            >
              Save draft
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              disabled={!canPreview}
              onClick={() => setNotice("Review each selected platform draft above before publishing.")}
            >
              Review selected
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!canSubmit || working}
              onClick={() => submitPost(publishMode)}
            >
              {working
                ? "Working…"
                : publishMode === "schedule"
                  ? "Schedule selected"
                  : "Publish selected"}
            </button>
          </div>
        </section>

        <div className="feed-secondary-grid">
          <section className="portal-card">
            <div className="portal-card-heading">
              <h2>Saved drafts</h2>
              <span className="portal-count">{savedDrafts.length}</span>
            </div>
            {savedDrafts.length ? (
              <div className="feed-post-list">
                {savedDrafts.map((post) => (
                  <article className="feed-post-summary" key={post.id}>
                    <strong>{post.master_caption}</strong>
                    <small>{new Date(post.created_at).toLocaleString()}</small>
                    <span>{post.targets.map((target) => target.provider).join(", ")}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="feed-empty-state">
                <span aria-hidden="true">◇</span>
                <strong>No saved drafts</strong>
                <p>Save a prepared post to finish it later.</p>
              </div>
            )}
          </section>

          <section className="portal-card">
            <div className="portal-card-heading">
              <h2>Upcoming posts</h2>
              <span className="portal-count">{scheduledPosts.length}</span>
            </div>
            {scheduledPosts.length ? (
              <div className="feed-post-list">
                {scheduledPosts.map((post) => (
                  <article className="feed-post-summary" key={post.id}>
                    <strong>{post.master_caption}</strong>
                    <small>{new Date(post.scheduled_at).toLocaleString()}</small>
                    <span>{post.targets.map((target) => target.provider).join(", ")}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="feed-empty-state">
                <span aria-hidden="true">◷</span>
                <strong>No posts scheduled</strong>
                <p>Your scheduled content will appear here.</p>
              </div>
            )}
          </section>

          <section className="portal-card">
            <div className="portal-card-heading">
              <h2>Connected accounts</h2>
              <span className="portal-count">{connectedProviders.size}</span>
            </div>
            {loading ? (
              <p className="portal-card-description">Loading destinations…</p>
            ) : connectedProviders.size ? (
              <div className="feed-connected-list">
                {connections.filter((connection) => connectedProviders.has(connection.provider)).map((connection) => (
                  <div key={connection.provider}>
                    <strong>{connection.name}</strong>
                    <span>{connection.provider_account_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="portal-card-description">
                No publishing destinations are connected.{" "}
                <Link to={`/org/${orgId}/social`}>Connect social accounts</Link>.
              </p>
            )}
          </section>

          {posts.some((post) => ["failed", "partial_failure"].includes(post.status)) && (
            <section className="portal-card feed-failures-card">
              <div className="portal-card-heading">
                <h2>Needs attention</h2>
              </div>
              <div className="feed-post-list">
                {posts.filter((post) => ["failed", "partial_failure"].includes(post.status)).map((post) => (
                  <article className="feed-post-summary" key={post.id}>
                    <strong>{postStatusLabel(post.status)}</strong>
                    {post.targets.filter((target) => target.error).map((target) => (
                      <small key={target.id}>{target.provider}: {target.error}</small>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
