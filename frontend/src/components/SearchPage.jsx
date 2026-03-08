import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchOrganizations } from "../api";

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      handleSearch(q);
    }
  }, []);

  function handleResultClick(feedbackToken) {
    navigate(`/feedback/${feedbackToken}`);
  }

  return (
    <div className="search-page">
      <div className="search-container">
        <h1 className="search-title">Find an Organization</h1>
        <p className="search-subtitle">Search for an organization to share your feedback</p>

        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search by organization name..."
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
                      <button
                        type="button"
                        className="search-result-button"
                        onClick={() => handleResultClick(org.feedback_token)}
                      >
                        <span className="search-result-name">{org.name}</span>
                        <span className="search-result-arrow">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="search-no-results">
                No organizations found matching "{query}". Try a different search term.
              </p>
            )}
          </div>
        )}

        {!hasSearched && (
          <div className="search-hint">
            <p>💡 You can also visit an organization directly if you have their feedback link.</p>
          </div>
        )}
      </div>
    </div>
  );
}
