import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFeedbackFormInfo, polishReview, submitFeedback } from "../api";

const PLATFORM_LABELS = { google: "Google Reviews", yelp: "Yelp", tripadvisor: "TripAdvisor" };

function destinationName(info) {
  return info.location_name
    ? `${info.organization_name} · ${info.location_name}`
    : info.organization_name;
}

export function FeedbackExperience({ info, onSubmit, onPolish, onChangeDestination = null }) {
  const [content, setContent] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedContent, setSubmittedContent] = useState(null);
  const [draft, setDraft] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState("");
  const [draftCopied, setDraftCopied] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit(content, submitterEmail || null, submitterName || null);
      setSubmittedContent(content);
      setDraft(content);
      setContent("");
      setSubmitterEmail("");
      setSubmitterName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePolish(style) {
    setPolishError("");
    setIsPolishing(true);
    try {
      const result = await onPolish(draft, style);
      setDraft(result.draft);
      setDraftCopied(false);
    } catch (err) {
      setPolishError(err.message === "AI not configured" ? "AI polish is not available." : err.message);
    } finally {
      setIsPolishing(false);
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 2000);
    } catch {
      // Clipboard access can be unavailable in privacy-focused browsers.
    }
  }

  if (submittedContent !== null) {
    const reviewLinks = info.review_links || [];
    return (
      <div className="feedback-page">
        <div className="feedback-card">
          <h2 className="feedback-title">Feedback submitted</h2>
          <p className="feedback-subtitle">
            Thank you for sharing with <strong>{destinationName(info)}</strong>.
          </p>

          {reviewLinks.length > 0 && (
            <div className="review-share-section">
              <p className="review-share-heading">Want to share publicly?</p>
              <p className="review-share-desc">Your draft is ready to copy and paste to a review site.</p>
              <div className="review-draft-box">
                <textarea
                  className="review-draft-textarea"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={5}
                />
                <div className="review-draft-actions">
                  <div className="review-polish-buttons">
                    {[
                      ["shorten", "Shorten"],
                      ["polish", "Polish"],
                      ["simplify", "Simplify"],
                    ].map(([style, label]) => (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => handlePolish(style)}
                        disabled={isPolishing}
                        key={style}
                      >
                        {label}
                      </button>
                    ))}
                    {isPolishing && <span className="review-polish-status">Working...</span>}
                  </div>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => copyToClipboard(draft)}>
                    {draftCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                {polishError && <p className="message message--error">{polishError}</p>}
              </div>

              <div className="review-platform-links">
                {reviewLinks.map((link) => (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--outline"
                    onClick={() => copyToClipboard(draft)}
                  >
                    {PLATFORM_LABELS[link.platform] || link.platform}
                  </a>
                ))}
              </div>
              <p className="review-share-hint">Clicking a platform copies your draft automatically.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <div className="feedback-card">
        {onChangeDestination && (
          <button className="feedback-change-destination" type="button" onClick={onChangeDestination}>
            ← Change destination
          </button>
        )}
        <h2 className="feedback-title">Share Your Feedback</h2>
        <p className="feedback-subtitle">
          Send private feedback to <strong>{destinationName(info)}</strong>
        </p>

        <form className="feedback-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="content">Your feedback *</label>
          <textarea
            className="field-textarea"
            id="content"
            rows="6"
            placeholder="Tell us what you think..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            maxLength={5000}
          />

          <div className="feedback-optional">
            <p className="feedback-optional-label">Optional: Add your contact info (not required)</p>
            <label className="field-label" htmlFor="name">Your name</label>
            <input
              className="field-input"
              id="name"
              type="text"
              placeholder="John Doe"
              value={submitterName}
              onChange={(event) => setSubmitterName(event.target.value)}
              maxLength={255}
            />
            <label className="field-label" htmlFor="email">Your email</label>
            <input
              className="field-input"
              id="email"
              type="email"
              placeholder="john@example.com"
              value={submitterEmail}
              onChange={(event) => setSubmitterEmail(event.target.value)}
            />
          </div>

          <button className="btn btn--primary btn--large" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
        {error && <p className="message message--error">{error}</p>}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const { feedbackToken } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setInfo(null);
    setError("");
    getFeedbackFormInfo(feedbackToken)
      .then((data) => { if (active) setInfo(data); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [feedbackToken]);

  if (error) {
    return <div className="feedback-page"><div className="feedback-card"><h2>Form Not Found</h2><p className="message message--error">{error}</p></div></div>;
  }
  if (!info) {
    return <div className="feedback-page"><div className="feedback-card"><p>Loading...</p></div></div>;
  }
  return (
    <FeedbackExperience
      info={info}
      onSubmit={(content, email, name) => submitFeedback(feedbackToken, content, email, name)}
      onPolish={(content, style) => polishReview(feedbackToken, content, style)}
    />
  );
}
