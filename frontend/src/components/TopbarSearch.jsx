import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchOrganizations } from "../api";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 480px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 480px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function TopbarSearch() {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  function expand() {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function collapse() {
    setIsExpanded(false);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  // Desktop: click-outside closes the inline input
  useEffect(() => {
    if (isMobile || !isExpanded) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        collapse();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isExpanded]);

  // Mobile: click-outside closes the pill panel
  useEffect(() => {
    if (!isMobile || !isExpanded) return;
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        collapse();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isExpanded]);

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
    collapse();
    navigate(`/feedback/${org.feedback_token}`);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { collapse(); return; }
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
      if (activeIndex >= 0) handleSelect(results[activeIndex]);
      else navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  const resultList = isOpen && results.length > 0 && (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        width: isMobile ? "100%" : 260,
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
  );

  // ── Desktop: inline expansion ──────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div ref={containerRef} style={{ position: "relative" }}>
        {isExpanded ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              background: "rgba(255, 253, 247, 0.92)",
              padding: "0 0.75rem",
              gap: "0.4rem",
              width: 220,
            }}
            className="topbar-search-wrap"
          >
            <span style={{ color: "#8a9aaa", fontSize: "1.2rem", flexShrink: 0 }}>⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
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
        ) : (
          <button
            type="button"
            className="hamburger"
            aria-label="Search organizations"
            onClick={expand}
          >
            <span style={{ fontSize: "1.6rem", lineHeight: 1, color: "var(--color-ink)" }}>⌕</span>
          </button>
        )}
        {resultList}
      </div>
    );
  }

  // ── Mobile: floating pill ──────────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        className="hamburger"
        aria-label="Search organizations"
        onClick={isExpanded ? collapse : expand}
      >
        <span style={{ fontSize: "1.6rem", lineHeight: 1, color: "var(--color-ink)" }}>⌕</span>
      </button>

      {isExpanded && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
            onClick={collapse}
          />
          <div
            ref={panelRef}
            className="topbar-search-panel"
            style={{
              position: "fixed",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(520px, calc(100vw - 2rem))",
              zIndex: 40,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "white",
                border: "1px solid var(--color-border)",
                borderRadius: results.length > 0 && isOpen ? "16px 16px 0 0" : "16px",
                padding: "0 1rem",
                gap: "0.5rem",
                boxShadow: "0 4px 20px rgba(45, 27, 66, 0.12)",
              }}
            >
              <span style={{ color: "#8a9aaa", fontSize: "1.2rem", flexShrink: 0 }}>⌕</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Search organizations…"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "1rem",
                  color: "var(--color-ink)",
                  padding: "0.85rem 0",
                }}
                aria-label="Search organizations"
                aria-autocomplete="list"
                aria-expanded={isOpen}
              />
              {isSearching && (
                <span style={{ color: "#aab4be", fontSize: "0.8rem", flexShrink: 0 }}>…</span>
              )}
            </div>

            {isOpen && results.length > 0 && (
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderTop: "none",
                  borderRadius: "0 0 16px 16px",
                  background: "white",
                  boxShadow: "0 8px 20px rgba(45, 27, 66, 0.1)",
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
                      padding: "0.75rem 1rem",
                      border: "none",
                      borderBottom: idx < results.length - 1 ? "1px solid #f0f3f6" : "none",
                      background: idx === activeIndex ? "#f4f8fb" : "white",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                      color: "var(--color-ink)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{org.name}</span>
                    <span style={{ color: "#aab4be", fontSize: "0.85rem" }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
