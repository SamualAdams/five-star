import { useState } from "react";
import {
  DEMO_ORG,
  DEMO_PREFILLED_REVIEW,
  DEMO_POLISHED_VARIANTS,
  DEMO_REVIEW_LINKS,
} from "./demoData";

const PLATFORM_LABELS = { google: "Google Reviews", yelp: "Yelp", tripadvisor: "TripAdvisor" };

function FeedbackForm({ onSubmitted }) {
  const [content, setContent] = useState(DEMO_PREFILLED_REVIEW.text);
  const [name, setName] = useState(DEMO_PREFILLED_REVIEW.name);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulated network delay — nothing is actually sent anywhere.
    setTimeout(() => onSubmitted(content), 500);
  }

  return (
    <div className="feedback-card">
      <h2 className="feedback-title">Share Your Feedback</h2>
      <p className="feedback-subtitle">
        Send anonymous feedback to <strong>{DEMO_ORG.name}</strong>
      </p>

      <form className="feedback-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="demo-content">Your feedback *</label>
        <textarea
          className="field-textarea"
          id="demo-content"
          rows="4"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={5000}
        />

        <div className="feedback-optional">
          <p className="feedback-optional-label">Optional: Add your contact info (not required)</p>
          <label className="field-label" htmlFor="demo-name">Your name</label>
          <input
            className="field-input"
            id="demo-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
          />
          <label className="field-label" htmlFor="demo-email">Your email</label>
          <input
            className="field-input"
            id="demo-email"
            type="email"
            placeholder="alex@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button className="btn btn--primary btn--large" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </button>
        <p className="demo-note">We prefilled this one for you — edit it if you like, then hit submit.</p>
      </form>
    </div>
  );
}

function ShareBoost({ draft, onDraftChange }) {
  const [isPolishing, setIsPolishing] = useState(false);
  const [activeStyle, setActiveStyle] = useState(null);
  const [draftCopied, setDraftCopied] = useState(false);
  const [platformNote, setPlatformNote] = useState("");

  const isModified = draft !== DEMO_PREFILLED_REVIEW.text;

  function handlePolish(style) {
    setIsPolishing(true);
    setPlatformNote("");
    // Simulated AI — pre-written variants, no API call.
    setTimeout(() => {
      onDraftChange(DEMO_POLISHED_VARIANTS[style]);
      setActiveStyle(style);
      setIsPolishing(false);
      setDraftCopied(false);
    }, 600);
  }

  function handleUseOriginal() {
    onDraftChange(DEMO_PREFILLED_REVIEW.text);
    setActiveStyle(null);
    setDraftCopied(false);
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      // clipboard unavailable — still show feedback so the demo flows
    }
    setDraftCopied(true);
    setTimeout(() => setDraftCopied(false), 2000);
  }

  function handlePlatformClick(platform) {
    copyDraft();
    setPlatformNote(
      `Copied your review — in the real app this opens ${DEMO_ORG.name}'s ${PLATFORM_LABELS[platform]} page.`
    );
  }

  return (
    <div className="feedback-card">
      <h2 className="feedback-title">Feedback submitted</h2>
      <p className="feedback-subtitle">
        Thank you for sharing with <strong>{DEMO_ORG.name}</strong>.
      </p>

      <div className="review-share-section">
        <p className="review-share-heading">Want to share publicly?</p>
        <p className="review-share-desc">Your draft is ready to copy and paste to a review site.</p>

        <div className="review-draft-box">
          <textarea
            className="review-draft-textarea"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={4}
          />
          <div className="review-draft-actions">
            <div className="review-polish-buttons">
              {["shorten", "polish", "simplify"].map((style) => (
                <button
                  key={style}
                  type="button"
                  className={`btn btn--ghost btn--sm ${activeStyle === style ? "demo-polish-active" : ""}`}
                  onClick={() => handlePolish(style)}
                  disabled={isPolishing}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
              {isPolishing && <span className="review-polish-status">Polishing…</span>}
              {!isPolishing && isModified && (
                <button type="button" className="demo-use-original" onClick={handleUseOriginal}>
                  Use original
                </button>
              )}
            </div>
            <button type="button" className="btn btn--primary btn--sm" onClick={copyDraft}>
              {draftCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="review-platform-links">
          {DEMO_REVIEW_LINKS.map((link) => (
            <button
              key={link.platform}
              type="button"
              className="btn btn--outline"
              onClick={() => handlePlatformClick(link.platform)}
            >
              {PLATFORM_LABELS[link.platform]}
            </button>
          ))}
        </div>
        {platformNote ? (
          <p className="review-share-hint demo-platform-note">{platformNote}</p>
        ) : (
          <p className="review-share-hint">Clicking a platform copies your draft automatically.</p>
        )}
        <p className="demo-note">
          These links are set by the business — you pick which platforms to send your customers to.
        </p>
      </div>
    </div>
  );
}

export default function DemoFeedbackScreen({ stage, draft, onDraftChange, onSubmitted }) {
  return (
    <div className="demo-screen">
      {stage === "boost" ? (
        <ShareBoost draft={draft} onDraftChange={onDraftChange} />
      ) : (
        <FeedbackForm onSubmitted={onSubmitted} />
      )}
    </div>
  );
}
