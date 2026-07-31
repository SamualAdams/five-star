import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicBoard, updatePublicInitiativeVote } from "../api";

const VISITOR_KEY = "five-star-board-visitor-id";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "gathering_feedback", label: "Gathering feedback" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "shipped", label: "Shipped" },
];

const SORT_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "updated", label: "Recently updated" },
];

function visitorId() {
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored) return stored;
    const generated = globalThis.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VISITOR_KEY, generated);
    return generated;
  } catch {
    return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function relativeDate(value) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.round(elapsed / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function scoreLabel(score) {
  return score > 0 ? `+${score}` : String(score);
}

export default function VotingBoardPage() {
  const { feedbackToken } = useParams();
  const [board, setBoard] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("top");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingId, setVotingId] = useState(null);

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getPublicBoard(feedbackToken, { query: search, status, sort, visitorId: visitorId() });
      setBoard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [feedbackToken, search, sort, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadBoard, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadBoard, search]);

  async function handleVote(initiative, value) {
    const nextValue = initiative.viewer_vote === value ? null : value;
    setVotingId(initiative.id);
    setError("");
    try {
      const updated = await updatePublicInitiativeVote(feedbackToken, initiative.id, nextValue, visitorId());
      setBoard((current) => current && {
        ...current,
        initiatives: current.initiatives.map((item) => (item.id === updated.id ? updated : item)),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setVotingId(null);
    }
  }

  if (isLoading && !board) {
    return <div className="board-page board-page--centered"><p className="board-state">Loading the roadmap…</p></div>;
  }

  if (error && !board) {
    return (
      <div className="board-page board-page--centered">
        <div className="board-state-card">
          <p className="board-eyebrow">Five Star</p>
          <h1>Roadmap not found</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const initiatives = board?.initiatives || [];

  return (
    <div className="board-page">
      <section className="board-hero">
        <p className="board-eyebrow">What we&apos;re working on</p>
        <h1>{board?.organization_name}</h1>
        <p className="board-location-name">{board?.location_name}</p>
        <p className="board-intro">Explore what&apos;s ahead, share what matters most, and watch ideas take shape.</p>
      </section>

      <section className="board-content" aria-label="Organization initiatives">
        <div className="board-toolbar">
          <label className="board-search">
            <span className="sr-only">Search initiatives</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              placeholder="Search what we&apos;re working on"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="board-sort" aria-label="Sort initiatives">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`board-sort-button${sort === option.value ? " board-sort-button--active" : ""}`}
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="board-filters" aria-label="Filter by status">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              className={`board-filter${status === option.value ? " board-filter--active" : ""}`}
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <p className="message message--error board-request-error">{error}</p>}

        {isLoading ? (
          <p className="board-state board-state--inline">Refreshing initiatives…</p>
        ) : initiatives.length ? (
          <div className="initiative-list">
            {initiatives.map((initiative) => (
              <article className="public-initiative-card" key={initiative.id}>
                <div className="initiative-votes" aria-label={`${initiative.score} vote score`}>
                  <button
                    type="button"
                    className={`initiative-vote-button${initiative.viewer_vote === 1 ? " initiative-vote-button--active" : ""}`}
                    onClick={() => handleVote(initiative, 1)}
                    disabled={votingId === initiative.id}
                    aria-label={`Upvote ${initiative.title}`}
                    aria-pressed={initiative.viewer_vote === 1}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <strong className="initiative-score">{scoreLabel(initiative.score)}</strong>
                  <button
                    type="button"
                    className={`initiative-vote-button${initiative.viewer_vote === -1 ? " initiative-vote-button--active initiative-vote-button--down" : ""}`}
                    onClick={() => handleVote(initiative, -1)}
                    disabled={votingId === initiative.id}
                    aria-label={`Downvote ${initiative.title}`}
                    aria-pressed={initiative.viewer_vote === -1}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <span className="initiative-vote-detail">{initiative.upvotes} up · {initiative.downvotes} down</span>
                </div>

                <div className="initiative-copy">
                  <div className="initiative-meta">
                    <span className={`initiative-status initiative-status--${initiative.status}`}>
                      {STATUS_OPTIONS.find((option) => option.value === initiative.status)?.label || initiative.status}
                    </span>
                    <span>Updated {relativeDate(initiative.updated_at)}</span>
                  </div>
                  <h2>{initiative.title}</h2>
                  <p>{initiative.description}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="board-empty-state">
            <h2>{search || status ? "No matching initiatives" : "Nothing here just yet"}</h2>
            <p>{search || status ? "Try another search or status." : "Check back soon to see what we're working on."}</p>
          </div>
        )}

        <p className="board-vote-note">Votes are anonymous and help this team understand what matters most.</p>
      </section>
    </div>
  );
}
