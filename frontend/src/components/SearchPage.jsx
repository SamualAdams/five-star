import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchOrganizations, submitUnlistedBusinessFeedback } from "../api";

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showMissingBusinessForm, setShowMissingBusinessForm] = useState(false);
  const [missingBusiness, setMissingBusiness] = useState({
    business_name: "",
    location_hint: "",
    content: "",
    submitter_name: "",
    submitter_email: "",
  });
  const [isSubmittingMissing, setIsSubmittingMissing] = useState(false);
  const [missingBusinessError, setMissingBusinessError] = useState("");
  const [missingBusinessSubmitted, setMissingBusinessSubmitted] = useState(false);

  async function handleSearch(searchQuery) {
    setQuery(searchQuery);

    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const orgs = await searchOrganizations(searchQuery);
      setResults(orgs);
    } catch (err) {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function openMissingBusinessForm() {
    setMissingBusiness((current) => ({
      ...current,
      business_name: current.business_name || query.trim(),
    }));
    setMissingBusinessError("");
    setShowMissingBusinessForm(true);
  }

  function updateMissingBusinessField(event) {
    const { name, value } = event.target;
    setMissingBusiness((current) => ({ ...current, [name]: value }));
  }

  async function handleMissingBusinessSubmit(event) {
    event.preventDefault();
    setIsSubmittingMissing(true);
    setMissingBusinessError("");

    try {
      await submitUnlistedBusinessFeedback({
        ...missingBusiness,
        submitter_name: missingBusiness.submitter_name || undefined,
        submitter_email: missingBusiness.submitter_email || undefined,
      });
      setMissingBusinessSubmitted(true);
    } catch (error) {
      setMissingBusinessError(error.message || "We couldn’t send your feedback. Please try again.");
    } finally {
      setIsSubmittingMissing(false);
    }
  }

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      handleSearch(q);
    }
  }, []);

  return (
    <div className="search-page">
      <div className="search-container">
        <h1 className="search-title">Who do you want to reach?</h1>
        <p className="search-subtitle">
          Search by business name, road, or location. No account required.
        </p>

        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Business name, road, or place..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {isSearching && <div className="search-spinner">Searching...</div>}
        </div>

        {hasSearched && !isSearching && (
          <div className="search-results">
            {results.length > 0 ? (
              <>
                <p className="search-results-count">
                  Found {results.length} organization{results.length !== 1 ? "s" : ""}
                </p>
                <ul className="search-results-list">
                  {results.map((org) => (
                    <li key={org.feedback_token} className="search-result-item">
                      <div className="search-result-card">
                        <span className="search-result-name">{org.name}</span>
                        <div className="search-result-actions">
                          {org.landing_enabled && (
                            <button className="btn btn--outline btn--sm" type="button" onClick={() => navigate(`/five-star/${org.feedback_token}`)}>
                              View organization page
                            </button>
                          )}
                          <button className="btn btn--primary btn--sm" type="button" onClick={() => navigate(`/feedback/organization/${org.feedback_token}`)}>
                            Leave feedback
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="search-missing-card">
                <h2>Don&apos;t see the business?</h2>
                <p>
                  Tell us who and where they are. You can still share your feedback, and we&apos;ll
                  find the right people to receive it.
                </p>
                <button className="btn btn--primary" type="button" onClick={openMissingBusinessForm}>
                  Tell us about this business
                </button>
              </div>
            )}
          </div>
        )}

        {hasSearched && results.length > 0 && !showMissingBusinessForm && (
          <button className="search-missing-link" type="button" onClick={openMissingBusinessForm}>
            Can&apos;t find the exact business or location?
          </button>
        )}

        {showMissingBusinessForm && (
          <section className="search-missing-form-card" aria-labelledby="missing-business-title">
            {missingBusinessSubmitted ? (
              <div className="search-missing-success">
                <p className="section-kicker">We&apos;ve got it</p>
                <h2 id="missing-business-title">We&apos;ll take it from here.</h2>
                <p>
                  We&apos;ll find the business, identify the right location, and make sure your
                  feedback gets where it belongs.
                </p>
              </div>
            ) : (
              <form onSubmit={handleMissingBusinessSubmit}>
                <p className="section-kicker">Not in the catalog yet</p>
                <h2 id="missing-business-title">Tell us what you know.</h2>
                <p className="search-missing-intro">
                  A business does not need to be listed for you to speak. Give us enough detail to
                  find it, then share what is on your mind.
                </p>

                <label className="field-label" htmlFor="missing-business-name">Business name</label>
                <input
                  id="missing-business-name"
                  className="search-input"
                  name="business_name"
                  value={missingBusiness.business_name}
                  onChange={updateMissingBusinessField}
                  maxLength={255}
                  required
                />

                <label className="field-label" htmlFor="missing-location">Location</label>
                <input
                  id="missing-location"
                  className="search-input"
                  name="location_hint"
                  value={missingBusiness.location_hint}
                  onChange={updateMissingBusinessField}
                  placeholder="Street, neighborhood, city, or nearby landmark"
                  maxLength={500}
                  required
                />

                <label className="field-label" htmlFor="missing-feedback">Your feedback</label>
                <textarea
                  id="missing-feedback"
                  className="search-missing-textarea"
                  name="content"
                  value={missingBusiness.content}
                  onChange={updateMissingBusinessField}
                  placeholder="Praise, concern, observation, or idea—big or small."
                  maxLength={5000}
                  rows={6}
                  required
                />

                <fieldset className="search-missing-optional">
                  <legend>Contact information (optional)</legend>
                  <p>You can leave this blank. We&apos;ll still share your feedback.</p>
                  <div className="search-missing-contact-grid">
                    <div>
                      <label className="field-label" htmlFor="missing-name">Name</label>
                      <input
                        id="missing-name"
                        className="search-input"
                        name="submitter_name"
                        value={missingBusiness.submitter_name}
                        onChange={updateMissingBusinessField}
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="missing-email">Email</label>
                      <input
                        id="missing-email"
                        className="search-input"
                        name="submitter_email"
                        type="email"
                        value={missingBusiness.submitter_email}
                        onChange={updateMissingBusinessField}
                      />
                    </div>
                  </div>
                </fieldset>

                {missingBusinessError && (
                  <p className="message message--error">{missingBusinessError}</p>
                )}

                <div className="search-missing-actions">
                  <button className="btn btn--primary" type="submit" disabled={isSubmittingMissing}>
                    {isSubmittingMissing ? "Sending…" : "Send it to five*"}
                  </button>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => setShowMissingBusinessForm(false)}
                  >
                    Back to search
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {!hasSearched && (
          <div className="search-hint">
            <p>Choose a business and location, then tell us what is on your mind. We&apos;ll take it from there.</p>
          </div>
        )}
      </div>
    </div>
  );
}
