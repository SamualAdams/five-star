import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchOrganizations } from "../api";

export default function TopbarSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val || val.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const orgs = await searchOrganizations(val);
        setResults(orgs);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);
  }

  function handleSelect(org) {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    navigate(`/feedback/${org.feedback_token}`);
  }

  function handleKeyDown(e) {
    if (!isOpen || !results.length) {
      if (e.key === "Enter" && query.trim().length >= 2) {
        navigate(`/search?q=${encodeURIComponent(query)}`);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        handleSelect(results[activeIndex]);
      } else {
        navigate(`/search?q=${encodeURIComponent(query)}`);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: 220 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          background: "#fafcfd",
          padding: "0 0.75rem",
          gap: "0.4rem",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
        }}
        className="topbar-search-wrap"
      >
        <span style={{ color: "#8a9aaa", fontSize: "0.9rem", flexShrink: 0 }}>⌕</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search organizations…"
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: "0.9rem",
            color: "var(--color-ink)",
            padding: "0.55rem 0",
          }}
          aria-label="Search organizations"
          aria-autocomplete="list"
          aria-expanded={isOpen}
        />
        {isSearching && (
          <span style={{ color: "#aab4be", fontSize: "0.75rem", flexShrink: 0 }}>…</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            border: "1px solid #d6dfe6",
            borderRadius: "12px",
            background: "white",
            boxShadow: "0 4px 12px rgba(45, 27, 66, 0.1)",
            zIndex: 50,
            overflow: "hidden",
          }}
          role="listbox"
        >
          {results.map((org, idx) => (
            <button
              key={org.feedback_token}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              onClick={() => handleSelect(org)}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 0.9rem",
                border: "none",
                borderBottom: idx < results.length - 1 ? "1px solid #f0f3f6" : "none",
                background: idx === activeIndex ? "#f4f8fb" : "white",
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "var(--color-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{org.name}</span>
              <span style={{ color: "#aab4be", fontSize: "0.8rem" }}>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
