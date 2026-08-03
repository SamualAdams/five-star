import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PortalPageHeader from "./PortalPageHeader";
import {
  createSocialPost,
  deleteSocialPost,
  generateSocialDrafts,
  generateWordsmithOptions,
  listSocialConnections,
  listSocialPosts,
  publishSocialPost,
  updateSocialPost,
  uploadOrganizationMedia,
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

function starterWordsmithOptions(source, style) {
  const normalized = source.trim().replace(/\s+/g, " ");
  const punctuated = /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
  const polished = punctuated.charAt(0).toUpperCase() + punctuated.slice(1);
  if (style === "shorten") {
    const direct = normalized.replace(/\b(really|very|just|actually|basically)\b\s*/gi, "").trim();
    const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0];
    return [
      { label: "More direct", text: direct || normalized },
      { label: "First thought", text: firstSentence || normalized },
      { label: "Clean and concise", text: polished },
    ];
  }
  if (style === "warmer") {
    return [
      { label: "Conversational", text: polished },
      { label: "Invite a response", text: `${polished} We’d love to hear what you think.` },
      { label: "Friendly and direct", text: `Here’s what’s happening: ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}` },
    ];
  }
  return [
    { label: "Polished", text: polished },
    { label: "Natural", text: normalized },
    { label: "Clear and direct", text: polished.replace(/\s+([,.!?])/g, "$1") },
  ];
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

export default function FeedPage({
  token,
  orgId,
  organizationName,
  locationId = null,
  locationName = null,
  publicPageUrl = "",
}) {
  const [message, setMessage] = useState("");
  const [captionSelection, setCaptionSelection] = useState({ start: 0, end: 0 });
  const [captionWordsmithing, setCaptionWordsmithing] = useState("");
  const [wordsmithOptions, setWordsmithOptions] = useState([]);
  const [wordsmithTarget, setWordsmithTarget] = useState(null);
  const [selectionMenu, setSelectionMenu] = useState({ visible: false, x: 0, y: 0 });
  const [drafts, setDrafts] = useState({});
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0].id);
  const [socialExpanded, setSocialExpanded] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [channels, setChannels] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wordsmithing, setWordsmithing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingPostCaption, setEditingPostCaption] = useState("");
  const [savingPostId, setSavingPostId] = useState(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [postActionMessage, setPostActionMessage] = useState(null);
  const submitLock = useRef(false);
  const messageInputRef = useRef(null);
  const messageWrapRef = useRef(null);
  const selectionMenuRef = useRef(null);

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
  const connectedChannels = useMemo(
    () => CHANNELS.filter((channel) => connectedProviders.has(channel.id)),
    [connectedProviders]
  );
  const selectedCaptionText = message.slice(captionSelection.start, captionSelection.end);
  const hasCaptionSelection = Boolean(selectedCaptionText.trim());
  const canDraft = Boolean(message.trim());
  const scheduledPosts = posts.filter((post) => post.status === "scheduled");
  const savedDrafts = posts.filter((post) => post.status === "draft");
  const publishedPosts = posts.filter((post) => ["published", "partial_failure"].includes(post.status));
  const selectedInstagramWithoutMedia = channels.includes("instagram") && !imageFile;
  const canSaveDraft = (
    Boolean(message.trim())
    && channels.every((channel) => drafts[channel]?.trim())
    && !selectedInstagramWithoutMedia
  );
  const canPublish = (
    Boolean(message.trim())
    && channels.every((channel) => drafts[channel]?.trim())
    && !selectedInstagramWithoutMedia
  );
  const canSubmit = canPublish && (
    !scheduleExpanded || (scheduleDate && scheduleTime)
  );

  async function loadPublishingData() {
    if (!token || !orgId) return;
    setLoading(true);
    setError("");
    try {
      const [connectionData, postData] = await Promise.all([
        listSocialConnections(token, orgId, locationId),
        listSocialPosts(token, orgId, 25, locationId),
      ]);
      setConnections(connectionData);
      setPosts(postData);
      const availableProviders = new Set(
        connectionData
          .filter((connection) => connection.connected && connection.status === "connected" && connection.publishing_enabled)
          .map((connection) => connection.provider)
      );
      const firstConnected = CHANNELS.find((channel) => availableProviders.has(channel.id));
      if (firstConnected) setActiveChannel(firstConnected.id);
      setChannels((current) => current.filter((provider) => availableProviders.has(provider)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPublishingData();
  }, [token, orgId, locationId]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  useEffect(() => {
    function closeSelectionMenu(event) {
      if (
        selectionMenuRef.current?.contains(event.target)
        || event.target === messageInputRef.current
      ) return;
      setSelectionMenu((current) => ({ ...current, visible: false }));
    }
    document.addEventListener("mousedown", closeSelectionMenu);
    return () => document.removeEventListener("mousedown", closeSelectionMenu);
  }, []);

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

  function captureCaptionSelection(event) {
    const nextSelection = {
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    };
    setCaptionSelection(nextSelection);
    return nextSelection;
  }

  function showSelectionMenu(event, preferPointer = false) {
    const nextSelection = captureCaptionSelection(event);
    const selected = event.currentTarget.value.slice(nextSelection.start, nextSelection.end).trim();
    if (!selected) {
      setSelectionMenu((current) => ({ ...current, visible: false }));
      return false;
    }
    const bounds = messageWrapRef.current?.getBoundingClientRect();
    const availableWidth = bounds?.width || 320;
    const menuWidth = Math.min(360, availableWidth - 16);
    const pointerX = preferPointer && "clientX" in event ? event.clientX - (bounds?.left || 0) : availableWidth - menuWidth - 8;
    const pointerY = preferPointer && "clientY" in event ? event.clientY - (bounds?.top || 0) + 12 : 12;
    setSelectionMenu({
      visible: true,
      x: Math.max(8, Math.min(pointerX, availableWidth - menuWidth - 8)),
      y: Math.max(8, pointerY),
    });
    if (wordsmithTarget?.scope !== "selection") {
      setWordsmithOptions([]);
      setWordsmithTarget(null);
    }
    return true;
  }

  async function wordsmithCaption(style, requestedScope = "caption") {
    if (!message.trim() || captionWordsmithing) return;
    if (requestedScope === "caption") {
      setSelectionMenu((current) => ({ ...current, visible: false }));
    }
    const target = requestedScope === "selection" && hasCaptionSelection
      ? {
          start: captionSelection.start,
          end: captionSelection.end,
          text: selectedCaptionText,
          scope: "selection",
        }
      : { start: 0, end: message.length, text: message, scope: "caption" };
    setCaptionWordsmithing(style);
    setWordsmithOptions([]);
    setWordsmithTarget({ ...target, sourceMessage: message });
    setError("");
    setNotice("");
    try {
      const generated = await generateWordsmithOptions(token, orgId, target.text, style, target.scope);
      setWordsmithOptions(generated.options);
    } catch {
      setWordsmithOptions(starterWordsmithOptions(target.text, style));
      setNotice("AI wordsmithing is unavailable locally, so starter edits are shown instead.");
    } finally {
      setCaptionWordsmithing("");
    }
  }

  function applyWordsmithOption(option) {
    if (!wordsmithTarget || wordsmithTarget.sourceMessage !== message) {
      setWordsmithOptions([]);
      setWordsmithTarget(null);
      setError("The caption changed. Choose a wordsmith option again.");
      return;
    }
    const nextMessage = wordsmithTarget.scope === "selection"
      ? `${message.slice(0, wordsmithTarget.start)}${option.text}${message.slice(wordsmithTarget.end)}`
      : option.text;
    const nextSelection = wordsmithTarget.scope === "selection"
      ? { start: wordsmithTarget.start, end: wordsmithTarget.start + option.text.length }
      : { start: 0, end: 0 };
    setMessage(nextMessage);
    setCaptionSelection(nextSelection);
    setWordsmithOptions([]);
    setWordsmithTarget(null);
    setSelectionMenu((current) => ({ ...current, visible: false }));
    setNotice("Wordsmith edit applied. Review it before publishing.");
    window.setTimeout(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(nextSelection.start, nextSelection.end);
    }, 0);
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
          : "AI drafts are ready. You can publish to Five* now or connect social destinations later."
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

  function beginEditingPost(post) {
    setEditingPostId(post.id);
    setEditingPostCaption(post.master_caption);
    setConfirmDeletePostId(null);
    setPostActionMessage(null);
  }

  async function saveEditedPost(post) {
    const caption = editingPostCaption.trim();
    if (!caption || savingPostId) return;
    setSavingPostId(post.id);
    setPostActionMessage(null);
    try {
      const updated = await updateSocialPost(token, orgId, post.id, {
        master_caption: caption,
      });
      setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingPostId(null);
      setEditingPostCaption("");
      setPostActionMessage({
        type: "success",
        text: post.targets.length
          ? "Five* post updated. Copies already published to social networks were not changed."
          : "Five* post updated.",
      });
    } catch (err) {
      setPostActionMessage({ type: "error", text: err.message });
    } finally {
      setSavingPostId(null);
    }
  }

  async function removePost(post) {
    if (deletingPostId) return;
    setDeletingPostId(post.id);
    setPostActionMessage(null);
    try {
      await deleteSocialPost(token, orgId, post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setConfirmDeletePostId(null);
      if (editingPostId === post.id) {
        setEditingPostId(null);
        setEditingPostCaption("");
      }
      setPostActionMessage({
        type: "success",
        text: post.targets.length
          ? "Post removed from Five*. Copies already published to social networks remain there."
          : "Post removed from Five*.",
      });
    } catch (err) {
      setPostActionMessage({ type: "error", text: err.message });
    } finally {
      setDeletingPostId(null);
    }
  }

  async function submitPost(submitMode = "now") {
    const validForMode = submitMode === "draft" ? canSaveDraft : canSubmit;
    if (!validForMode || working || submitLock.current) return;
    submitLock.current = true;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      let scheduledAt = null;
      if (scheduleExpanded && scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      }
      let uploadedMediaUrl = "";
      if (imageFile) {
        if (uploadedImage?.file === imageFile) {
          uploadedMediaUrl = uploadedImage.url;
        } else {
          setNotice("Uploading image…");
          const uploaded = await uploadOrganizationMedia(token, orgId, imageFile);
          uploadedMediaUrl = uploaded.url;
          setUploadedImage({ file: imageFile, url: uploaded.url });
        }
      }
      const created = await createSocialPost(token, orgId, {
        master_caption: message.trim(),
        targets: channels.map((provider) => ({
          provider,
          content: drafts[provider].trim(),
        })),
        media_urls: uploadedMediaUrl ? [uploadedMediaUrl] : [],
        scheduled_at: scheduledAt,
        location_id: locationId,
      });
      const completed = !scheduledAt
        ? await publishSocialPost(token, orgId, created.id)
        : created;
      setPosts((current) => [completed, ...current.filter((post) => post.id !== completed.id)]);
      setNotice(
        submitMode === "draft"
          ? "Draft saved."
          : scheduledAt
            ? "Post scheduled."
          : completed.status === "published"
            ? "Published to your Five* feed."
            : completed.status === "partial_failure"
              ? "Published to Five*. One or more social destinations need attention."
              : "Five* publishing failed. Review the error below."
      );
      setMessage("");
      setCaptionSelection({ start: 0, end: 0 });
      setWordsmithOptions([]);
      setWordsmithTarget(null);
      setSelectionMenu((current) => ({ ...current, visible: false }));
      setDrafts({});
      setChannels([]);
      setImageFile(null);
      setUploadedImage(null);
      setScheduleDate("");
      setScheduleTime("");
      setScheduleExpanded(false);
      setSocialExpanded(false);
      setImageExpanded(false);
    } catch (err) {
      setError(err.message);
    } finally {
      submitLock.current = false;
      setWorking(false);
    }
  }

  return (
    <div className="feed-page">
      <PortalPageHeader
        actionHref={publicPageUrl}
        actionLabel="Open public page"
        description="Publish directly to your Five* feed, then optionally send adapted versions to connected social accounts."
        eyebrow="Workspace"
        title="Feed"
      />

      <div className="feed-layout">
        <section className="portal-card feed-workspace">
          <div className="feed-workspace-heading">
            <div>
              <span className="status-pill status-pill--connected">Draft workspace</span>
              <h2>Create a post</h2>
              <p>The master caption is your Five* post. Social versions are optional.</p>
            </div>
            <span className="feed-org-label">{locationName || `${organizationName} · All locations`}</span>
          </div>

          <div className="feed-master-section">
            <label className="field-label" htmlFor="feed-message">Master caption</label>
            <div className="feed-message-wrap" ref={messageWrapRef}>
              <textarea
                className="field-textarea feed-message"
                id="feed-message"
                onChange={(event) => {
                  setMessage(event.target.value);
                  setWordsmithOptions([]);
                  setWordsmithTarget(null);
                  setSelectionMenu((current) => ({ ...current, visible: false }));
                  captureCaptionSelection(event);
                }}
                onContextMenu={(event) => {
                  if (showSelectionMenu(event, true)) event.preventDefault();
                }}
                onKeyUp={(event) => showSelectionMenu(event)}
                onMouseUp={(event) => showSelectionMenu(event, true)}
                onSelect={captureCaptionSelection}
                placeholder="Share the idea, announcement, or update you want to turn into platform posts…"
                ref={messageInputRef}
                rows="4"
                value={message}
              />

              {selectionMenu.visible && hasCaptionSelection && (
                <div
                  className="feed-selection-wordsmith"
                  onMouseDown={(event) => event.preventDefault()}
                  ref={selectionMenuRef}
                  style={{ left: selectionMenu.x, top: selectionMenu.y }}
                >
                  <div className="feed-selection-wordsmith-heading">
                    <strong>AI edit selection</strong>
                    <small>“{selectedCaptionText}”</small>
                  </div>
                  {wordsmithTarget?.scope === "selection" && wordsmithOptions.length ? (
                    <div className="feed-selection-options">
                      {wordsmithOptions.map((option) => (
                        <button key={`${option.label}-${option.text}`} onClick={() => applyWordsmithOption(option)} type="button">
                          <strong>{option.label}</strong>
                          <span>{option.text}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="feed-selection-wordsmith-actions">
                      {[
                        ["polish", "Polish"],
                        ["shorten", "Shorten"],
                        ["warmer", "Warmer"],
                      ].map(([style, label]) => (
                        <button
                          disabled={Boolean(captionWordsmithing)}
                          key={style}
                          onClick={() => wordsmithCaption(style, "selection")}
                          type="button"
                        >
                          {captionWordsmithing === style ? "…" : label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="feed-caption-wordsmith">
              <div className="feed-caption-wordsmith-heading">
                <div>
                  <strong>AI wordsmith</strong>
                  <span>Entire caption</span>
                </div>
                <div className="feed-caption-wordsmith-actions" aria-label="Wordsmith style">
                  {[
                    ["polish", "Polish"],
                    ["shorten", "Shorten"],
                    ["warmer", "Make warmer"],
                  ].map(([style, label]) => (
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={!message.trim() || Boolean(captionWordsmithing)}
                      key={style}
                      onClick={() => wordsmithCaption(style, "caption")}
                      type="button"
                    >
                      {captionWordsmithing === style ? "Thinking…" : label}
                    </button>
                  ))}
                </div>
              </div>

              {wordsmithTarget?.scope === "caption" && wordsmithOptions.length > 0 && (
                <div className="feed-wordsmith-options" aria-label="Wordsmith suggestions">
                  {wordsmithOptions.map((option) => (
                    <button key={`${option.label}-${option.text}`} onClick={() => applyWordsmithOption(option)} type="button">
                      <strong>{option.label}</strong>
                      <span>{option.text}</span>
                      <small>Use this</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="feed-image-disclosure">
              <button
                aria-expanded={imageExpanded}
                className="feed-image-toggle"
                onClick={() => setImageExpanded((current) => !current)}
                type="button"
              >
                <span aria-hidden="true">{imageExpanded ? "−" : "+"}</span>
                {imageFile ? "Image added" : "Add an image"}
                <small>Optional</small>
              </button>
              {imageExpanded && (
                <div className="feed-image-upload">
                  {imageFile ? (
                    <div className="feed-image-preview">
                      <img alt="Post preview" src={imagePreviewUrl} />
                      <div>
                        <strong>{imageFile.name}</strong>
                        <small>{(imageFile.size / (1024 * 1024)).toFixed(1)} MB</small>
                      </div>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setImageFile(null);
                          setUploadedImage(null);
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="feed-image-picker" htmlFor="feed-image-upload">
                      <span className="feed-media-icon" aria-hidden="true">＋</span>
                      <span>
                        <strong>Choose an image</strong>
                        <small>JPEG, PNG, or WebP · up to 8 MB</small>
                      </span>
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        id="feed-image-upload"
                        onChange={(event) => {
                          const selected = event.target.files?.[0] || null;
                          event.target.value = "";
                          if (selected && selected.size > 8 * 1024 * 1024) {
                            setError("Images must be 8 MB or smaller.");
                            return;
                          }
                          setError("");
                          setImageFile(selected);
                          setUploadedImage(null);
                        }}
                        type="file"
                      />
                    </label>
                  )}
                  {channels.includes("instagram") && <small className="feed-image-note">Instagram requires an image.</small>}
                </div>
              )}
            </div>
          </div>

          {selectedInstagramWithoutMedia && (
            <p className="message message--error">Add an image link to include Instagram.</p>
          )}
          {error && <p className="message message--error" role="alert">{error}</p>}
          {notice && <p className="message message--success" role="status">{notice}</p>}

          <section className="feed-schedule-section" aria-labelledby="feed-schedule-heading">
            <button
              aria-expanded={scheduleExpanded}
              className="feed-image-toggle"
              onClick={() => setScheduleExpanded((current) => !current)}
              type="button"
              id="feed-schedule-heading"
            >
              <span aria-hidden="true">{scheduleExpanded ? "−" : "+"}</span>
              Schedule post
              <small>Optional</small>
            </button>

            {scheduleExpanded && (
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
          </section>

          <div className="feed-composer-actions">
            <button
              className="btn btn--ghost"
              type="button"
              disabled={!canSaveDraft || working}
              onClick={() => submitPost("draft")}
            >
              Save draft
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!canSubmit || working}
              onClick={() => submitPost("now")}
            >
              {working
                ? "Working…"
                : scheduleExpanded && scheduleDate && scheduleTime
                  ? "Schedule post"
                  : "Publish to Five*"}
            </button>
          </div>

          <section className={`feed-drafts-section${socialExpanded ? " feed-drafts-section--expanded" : ""}`} aria-labelledby="feed-drafts-heading">
            <button
              aria-expanded={socialExpanded}
              className="feed-drafts-toggle"
              onClick={() => setSocialExpanded((current) => !current)}
              type="button"
            >
              <span>
                <strong id="feed-drafts-heading">Social publishing</strong>
                <small>Optional versions for connected accounts</small>
              </span>
              <span className="feed-drafts-toggle-status">
                {connectedChannels.length ? `${connectedChannels.length} connected` : "No accounts connected"}
                <span aria-hidden="true">{socialExpanded ? "−" : "+"}</span>
              </span>
            </button>

            {socialExpanded && (
              <div className="feed-drafts-content">
                {connectedChannels.length ? (
                  <>
                    <div className="feed-wordsmith-bar">
                      <div>
                        <strong>AI wordsmith</strong>
                        <span>Adapt the Five* caption for your connected platforms.</span>
                      </div>
                      <button className="btn btn--ghost btn--sm" disabled={!canDraft || wordsmithing} onClick={generatePlatformDrafts} type="button">
                        {wordsmithing ? "Wordsmithing…" : "Wordsmith with AI"}
                      </button>
                    </div>

                    <div className="feed-draft-tabs" role="tablist" aria-label="Connected platform drafts">
                      {connectedChannels.map((channel) => (
                        <button
                          aria-selected={activeChannel === channel.id}
                          className={`feed-draft-tab${activeChannel === channel.id ? " feed-draft-tab--active" : ""}`}
                          key={channel.id}
                          onClick={() => setActiveChannel(channel.id)}
                          role="tab"
                          type="button"
                        >
                          <span className="feed-draft-tab-mark" aria-hidden="true">{channel.label.slice(0, 1)}</span>
                          <span>{channel.label}</span>
                          <span className={`feed-draft-tab-check${channels.includes(channel.id) ? " feed-draft-tab-check--selected" : ""}`} aria-hidden="true">
                            {channels.includes(channel.id) ? "✓" : "+"}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="feed-draft-panel" role="tabpanel">
                      <div className="feed-draft-panel-heading">
                        <div>
                          <h4>{activePlatform.label} version</h4>
                          <p>{activePlatform.prompt}</p>
                        </div>
                        <label className="feed-draft-include">
                          <input
                            checked={channels.includes(activeChannel)}
                            onChange={() => toggleChannel(activeChannel)}
                            type="checkbox"
                          />
                          Include with Five* post
                        </label>
                      </div>
                      <textarea
                        aria-label={`${activePlatform.label} version`}
                        className="field-textarea feed-platform-draft"
                        onChange={(event) => updateActiveDraft(event.target.value)}
                        placeholder={`Write a ${activePlatform.label} version…`}
                        rows="5"
                        value={activeDraft}
                      />
                      <div className="feed-draft-panel-footer">
                        <span>{activeDraft.length} characters</span>
                        <button className="btn btn--ghost btn--sm" disabled={!message.trim()} onClick={resetActiveDraft} type="button">
                          Use Five* caption
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="feed-no-connections">
                    <div>
                      <strong>No social accounts are connected</strong>
                      <p>You can publish to Five* without connecting anything.</p>
                    </div>
                    <Link className="btn btn--ghost btn--sm" to={`/org/${orgId}/social`}>Connect accounts</Link>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>

        <div className="feed-secondary-grid">
          <section className="portal-card feed-recent-card">
            <div className="portal-card-heading">
              <h2>Recent Five* posts</h2>
              <span className="portal-count">{publishedPosts.length}</span>
            </div>
            {postActionMessage && (
              <p
                className={`message message--${postActionMessage.type}`}
                role={postActionMessage.type === "error" ? "alert" : "status"}
              >
                {postActionMessage.text}
              </p>
            )}
            {publishedPosts.length ? (
              <div className="feed-post-list">
                {publishedPosts.map((post) => (
                  <article className="feed-post-summary" key={post.id}>
                    {post.media_urls?.[0] && <img alt="" className="feed-post-summary-image" src={post.media_urls[0]} />}
                    {editingPostId === post.id ? (
                      <div className="feed-post-edit-form">
                        <label className="field-label" htmlFor={`feed-post-edit-${post.id}`}>Edit Five* caption</label>
                        <textarea
                          className="field-textarea"
                          id={`feed-post-edit-${post.id}`}
                          onChange={(event) => setEditingPostCaption(event.target.value)}
                          rows="3"
                          value={editingPostCaption}
                        />
                        <div className="feed-post-edit-actions">
                          <button
                            className="btn btn--ghost btn--sm"
                            disabled={savingPostId === post.id}
                            onClick={() => {
                              setEditingPostId(null);
                              setEditingPostCaption("");
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn--primary btn--sm"
                            disabled={!editingPostCaption.trim() || savingPostId === post.id}
                            onClick={() => saveEditedPost(post)}
                            type="button"
                          >
                            {savingPostId === post.id ? "Saving…" : "Save changes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <strong>{post.master_caption}</strong>
                    )}
                    <small>Published {new Date(post.published_at).toLocaleString()}</small>
                    <span>
                      {post.targets.length
                        ? `${post.targets.filter((target) => target.status === "published").length} of ${post.targets.length} social destinations published`
                        : "Five* only"}
                    </span>
                    {editingPostId !== post.id && <div className="feed-post-summary-actions">
                      {confirmDeletePostId === post.id ? (
                        <div className="feed-post-delete-confirmation">
                          <span>
                            {post.targets.length
                              ? "Remove from Five*? Published social copies will remain."
                              : "Remove this post from Five*?"}
                          </span>
                          <div>
                            <button
                              className="btn btn--ghost btn--sm"
                              disabled={deletingPostId === post.id}
                              onClick={() => setConfirmDeletePostId(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn--danger btn--sm"
                              disabled={deletingPostId === post.id}
                              onClick={() => removePost(post)}
                              type="button"
                            >
                              {deletingPostId === post.id ? "Deleting…" : "Delete post"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            className="btn btn--ghost btn--sm"
                            disabled={editingPostId === post.id}
                            onClick={() => beginEditingPost(post)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn--ghost btn--sm feed-post-delete-button"
                            onClick={() => {
                              setConfirmDeletePostId(post.id);
                              setEditingPostId(null);
                              setEditingPostCaption("");
                              setPostActionMessage(null);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>}
                  </article>
                ))}
              </div>
            ) : (
              <div className="feed-empty-state">
                <strong>No Five* posts yet</strong>
                <p>Published posts will appear here immediately.</p>
              </div>
            )}
          </section>

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
                    <span>
                      {connection.provider_account_name}
                      {connection.inherited ? " · organization account" : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="portal-card-description">
                This post will still publish to Five*.{" "}
                <Link to={`/org/${orgId}/social`}>Connect social accounts</Link> to publish everywhere at once.
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
