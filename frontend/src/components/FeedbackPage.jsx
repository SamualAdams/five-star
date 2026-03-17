import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFeedbackFormInfo, submitFeedback, polishReview } from "../api";

const PLATFORM_LABELS = { google: "Google Reviews", yelp: "Yelp", tripadvisor: "TripAdvisor" };

export default function FeedbackPage() {
  const { feedbackToken } = useParams();
  const [orgInfo, setOrgInfo] = useState(null);
  const [content, setContent] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedContent, setSubmittedContent] = useState(null);

  // Post-submission AI draft state
  const [draft, setDraft] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState("");
  const [copied, setCopied] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  useEffect(() => {
    async function loadFormInfo() {
      try {
        const data = await getFeedbackFormInfo(feedbackToken);
        setOrgInfo(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadFormInfo();
  }, [feedbackToken]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await submitFeedback(feedbackToken, content, submitterEmail || null, submitterName || null);
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
      const result = await polishReview(feedbackToken, draft, style);
      setDraft(result.draft);
      setDraftCopied(false);
    } catch (err) {
      setPolishError(err.message === "AI not configured" ? "AI polish is not available." : err.message);
    } finally {
      setIsPolishing(false);
    }
  }

  async function copyToClipboard(text, setCopiedState) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    } catch {
      // ignore
    }
  }

  if (isLoading) return <div className="feedback-page"><div className="feedback-card"><p>Loading...</p></div></div>;
  if (error && !orgInfo) return <div className="feedback-page"><div className="feedback-card"><h2>Form Not Found</h2><p className="message message--error">{error}</p></div></div>;

  if (submittedContent !== null) {
    const reviewLinks = orgInfo?.review_links || [];

    return (
      <div className="feedback-page">
        <div className="feedback-card">
<h2 className="feedback-title">Feedback submitted</h2>
          <p className="feedback-subtitle">Thank you for sharing with <strong>{orgInfo.organization_name}</strong>.</p>

          {reviewLinks.length > 0 && (
            <div className="review-share-section">
              <p className="review-share-heading">Want to share publicly?</p>
              <p className="review-share-desc">Your draft is ready to copy and paste to a review site.</p>

              <div className="review-draft-box">
                <textarea
                  className="review-draft-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={5}
                />
                <div className="review-draft-actions">
                  <div className="review-polish-buttons">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => handlePolish("shorten")}
                      disabled={isPolishing}
                    >
                      Shorten
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => handlePolish("polish")}
                      disabled={isPolishing}
                    >
                      Polish
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => handlePolish("simplify")}
                      disabled={isPolishing}
                    >
                      Simplify
                    </button>
                    {isPolishing && <span className="review-polish-status">Working...</span>}
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => copyToClipboard(draft, setDraftCopied)}
                  >
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
                    onClick={() => copyToClipboard(draft, setDraftCopied)}
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
        <h2 className="feedback-title">Share Your Feedback</h2>
        <p className="feedback-subtitle">Send anonymous feedback to <strong>{orgInfo.organization_name}</strong></p>

        <form className="feedback-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="content">Your feedback *</label>
          <textarea
            className="field-textarea"
            id="content"
            rows="6"
            placeholder="Tell us what you think..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
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
              onChange={(e) => setSubmitterName(e.target.value)}
              maxLength={255}
            />
            <label className="field-label" htmlFor="email">Your email</label>
            <input
              className="field-input"
              id="email"
              type="email"
              placeholder="john@example.com"
              value={submitterEmail}
              onChange={(e) => setSubmitterEmail(e.target.value)}
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
