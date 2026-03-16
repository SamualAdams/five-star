import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFeedbackFormInfo, submitFeedback } from "../api";

export default function FeedbackPage() {
  const { feedbackToken } = useParams();
  const [orgInfo, setOrgInfo] = useState(null);
  const [content, setContent] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      setSubmitted(true);
      setContent("");
      setSubmitterEmail("");
      setSubmitterName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="feedback-page"><div className="feedback-card"><p>Loading...</p></div></div>;
  if (error && !orgInfo) return <div className="feedback-page"><div className="feedback-card"><h2>Form Not Found</h2><p className="message message--error">{error}</p></div></div>;
  if (submitted) {
    return (
      <div className="feedback-page">
        <div className="feedback-card">
          <h2 className="feedback-title">Thank you!</h2>
          <p className="feedback-subtitle">Your feedback has been submitted to <strong>{orgInfo.organization_name}</strong>.</p>
          {orgInfo.review_url && (
            <div className="review-nudge">
              <p>Enjoyed your experience? We&apos;d love a public review!</p>
              <a
                href={orgInfo.review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--primary"
              >
                Leave a public review
              </a>
            </div>
          )}
          <button type="button" className="btn btn--ghost" onClick={() => setSubmitted(false)}>Submit another</button>
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
