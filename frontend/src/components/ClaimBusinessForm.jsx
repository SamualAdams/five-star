import { useState } from "react";
import { submitBusinessClaim } from "../api";

const EMPTY_CLAIM = {
  business_name: "",
  business_address: "",
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_phone: "",
  message: "",
};

// With a directory `place`, claims it. Without one, an owner asks us to list their business.
export default function ClaimBusinessForm({ place = null, address, initialName = "", onBack }) {
  const [claim, setClaim] = useState({ ...EMPTY_CLAIM, business_name: initialName });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setClaim((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await submitBusinessClaim({
        ...claim,
        directory_place_id: place?.id,
        business_name: place ? undefined : claim.business_name,
        business_address: place ? undefined : claim.business_address,
        contact_role: claim.contact_role || undefined,
        message: claim.message || undefined,
      });
      setSubmitted(true);
    } catch {
      setError("We couldn’t send your request. Check your details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="search-missing-form-card" aria-labelledby="claim-business-title">
      {submitted ? (
        <div className="search-missing-success">
          <p className="section-kicker">Request received</p>
          <h2 id="claim-business-title">We&apos;ll be in touch.</h2>
          <p>
            Thanks, {claim.contact_name.split(" ")[0]}. Someone from five* will reach out to confirm you
            run {place ? place.name : claim.business_name} and get your business{place ? " set up" : " listed"}.
          </p>
          <button className="btn btn--ghost" type="button" onClick={onBack}>
            Back to search
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {place ? (
            <>
              <p className="section-kicker">Claim this business</p>
              <h2 id="claim-business-title">{place.name}</h2>
              <p className="search-missing-intro">
                {address}
                {address && <br />}
                Run this business? Claim it to see what customers tell you and fix details that are
                wrong or out of date. We&apos;ll verify it&apos;s you before anything changes.
              </p>
            </>
          ) : (
            <>
              <p className="section-kicker">For business owners</p>
              <h2 id="claim-business-title">Add your business</h2>
              <p className="search-missing-intro">
                Run a business that isn&apos;t listed? Tell us where it is and how to reach you.
                We&apos;ll verify it&apos;s yours and get it on five* so customers can find it.
              </p>

              <label className="field-label" htmlFor="claim-business-name">Business name</label>
              <input
                id="claim-business-name"
                className="search-input"
                name="business_name"
                value={claim.business_name}
                onChange={updateField}
                autoComplete="organization"
                minLength={2}
                maxLength={255}
                required
              />

              <label className="field-label" htmlFor="claim-business-address">Address</label>
              <input
                id="claim-business-address"
                className="search-input"
                name="business_address"
                value={claim.business_address}
                onChange={updateField}
                placeholder="Street address and city"
                autoComplete="street-address"
                minLength={2}
                maxLength={500}
                required
              />
            </>
          )}

          <div className="search-missing-contact-grid search-claim-contact-grid">
            <div>
              <label className="field-label" htmlFor="claim-name">Your name</label>
              <input
                id="claim-name"
                className="search-input"
                name="contact_name"
                value={claim.contact_name}
                onChange={updateField}
                autoComplete="name"
                minLength={2}
                maxLength={255}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="claim-role">Your role (optional)</label>
              <input
                id="claim-role"
                className="search-input"
                name="contact_role"
                value={claim.contact_role}
                onChange={updateField}
                placeholder="Owner, manager…"
                autoComplete="organization-title"
                maxLength={255}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="claim-email">Email</label>
              <input
                id="claim-email"
                className="search-input"
                name="contact_email"
                type="email"
                value={claim.contact_email}
                onChange={updateField}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="claim-phone">Phone</label>
              <input
                id="claim-phone"
                className="search-input"
                name="contact_phone"
                type="tel"
                value={claim.contact_phone}
                onChange={updateField}
                autoComplete="tel"
                minLength={7}
                maxLength={40}
                required
              />
            </div>
          </div>

          <label className="field-label" htmlFor="claim-message">Anything we should know? (optional)</label>
          <textarea
            id="claim-message"
            className="search-missing-textarea"
            name="message"
            value={claim.message}
            onChange={updateField}
            placeholder={
              place
                ? "Wrong address or name, closed location, best time to call…"
                : "What you do, other locations, best time to call…"
            }
            maxLength={5000}
            rows={4}
          />

          {error && <p className="message message--error">{error}</p>}

          <div className="search-missing-actions">
            <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : place ? "Request to claim" : "Request to be listed"}
            </button>
            <button className="btn btn--ghost" type="button" onClick={onBack}>
              Back to search
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
