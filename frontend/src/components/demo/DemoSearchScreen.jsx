import { useState } from "react";
import { DEMO_ORG, DEMO_SEARCH_RESULTS } from "./demoData";

export default function DemoSearchScreen({ onSelect }) {
  const [query, setQuery] = useState("magnolia");

  const trimmed = query.trim().toLowerCase();
  const results =
    trimmed.length >= 2
      ? DEMO_SEARCH_RESULTS.filter((org) => org.name.toLowerCase().includes(trimmed))
      : [];

  return (
    <div className="demo-screen">
      <div className="search-container demo-search-container">
        <h1 className="search-title">Find an Organization</h1>
        <p className="search-subtitle">Search for an organization to share your feedback</p>

        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search by organization name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {results.length > 0 ? (
          <div className="search-results">
            <p className="search-results-count">
              Found {results.length} organization{results.length !== 1 ? "s" : ""}
            </p>
            <ul className="search-results-list">
              {results.map((org) => (
                <li key={org.id} className="search-result-item">
                  <button
                    type="button"
                    className="search-result-button"
                    onClick={() => onSelect(org)}
                  >
                    <span className="search-result-name">{org.name}</span>
                    <span className="search-result-arrow">→</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="demo-note">
              Click <strong>{DEMO_ORG.name}</strong> to leave them feedback.
            </p>
          </div>
        ) : (
          <p className="search-no-results">
            {trimmed.length >= 2
              ? `No organizations found matching "${query}". Try "magnolia".`
              : "Try typing “magnolia”."}
          </p>
        )}
      </div>
    </div>
  );
}
