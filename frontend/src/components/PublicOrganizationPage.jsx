import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getFeedbackFormInfo,
  getPublicOrganizationFeed,
  getPublicOrganizationHub,
  getPublicOrganizationRoadmap,
  updatePublicOrganizationInitiativeVote,
  updatePublicSocialPostReaction,
} from "../api";

const ASTERISK_SRC = `${import.meta.env.BASE_URL}brand/five-star-asterisk.svg`;
const LOGO_SRC = `${import.meta.env.BASE_URL}brand/five-star-logo.svg`;
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
    const generated = globalThis.crypto?.randomUUID?.()
      || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function scoreLabel(score) {
  return score > 0 ? `+${score}` : String(score);
}

function LocationTabs({ locations, selectedLocationId, onSelect }) {
  return (
    <div className="public-location-tabs" role="tablist" aria-label="Filter by location">
      <button
        aria-selected={!selectedLocationId}
        className={!selectedLocationId ? "public-location-tab public-location-tab--active" : "public-location-tab"}
        onClick={() => onSelect(null)}
        role="tab"
        type="button"
      >
        All locations
      </button>
      {locations.map((location) => (
        <button
          aria-selected={selectedLocationId === location.id}
          className={selectedLocationId === location.id ? "public-location-tab public-location-tab--active" : "public-location-tab"}
          key={location.id}
          onClick={() => onSelect(location.id)}
          role="tab"
          type="button"
        >
          {location.name}
        </button>
      ))}
    </div>
  );
}

function PublicFeed({ organizationToken, locations, selectedLocationId, onSelectLocation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reactingId, setReactingId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getPublicOrganizationFeed(organizationToken, selectedLocationId, visitorId())
      .then((data) => {
        if (active) setPosts(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [organizationToken, selectedLocationId]);

  async function handleReaction(post) {
    setReactingId(post.id);
    setError("");
    try {
      const updated = await updatePublicSocialPostReaction(
        organizationToken,
        post.id,
        !post.viewer_reacted,
        visitorId()
      );
      setPosts((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err.message);
    } finally {
      setReactingId(null);
    }
  }

  return (
    <>
      <section className="public-hub-filter-panel" aria-label="Feed filters">
        <LocationTabs locations={locations} selectedLocationId={selectedLocationId} onSelect={onSelectLocation} />
      </section>
      {error && <p className="message message--error">{error}</p>}
      {loading ? (
        <p className="public-hub-state public-hub-panel">Loading updates…</p>
      ) : posts.length ? (
        <div className="public-feed-list">
          {posts.map((post) => (
            <article className="public-feed-card" key={post.id}>
              <header className="public-feed-card-header">
                <div>
                  <strong>{post.location_name || "Organization-wide"}</strong>
                  <span>Published {relativeDate(post.published_at)}</span>
                </div>
              </header>
              {post.media_urls?.[0] && (
                <img alt="Image shared with this post" className="public-feed-image" src={post.media_urls[0]} />
              )}
              <div className="public-feed-copy">
                <div className="public-feed-actions">
                  <button
                    aria-label={post.viewer_reacted ? "Unlike this post" : "Like this post"}
                    aria-pressed={post.viewer_reacted}
                    className={post.viewer_reacted ? "public-feed-reaction public-feed-reaction--active" : "public-feed-reaction"}
                    disabled={reactingId === post.id}
                    onClick={() => handleReaction(post)}
                    type="button"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.3l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                    </svg>
                  </button>
                  <span>{post.reaction_count} {post.reaction_count === 1 ? "like" : "likes"}</span>
                </div>
                <p>{post.master_caption}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="public-hub-empty public-hub-panel">
          <h2>No updates yet</h2>
          <p>Check back soon for news from this organization.</p>
        </div>
      )}
    </>
  );
}

function PublicRoadmap({ organizationToken, locations, selectedLocationId, onSelectLocation }) {
  const [board, setBoard] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("top");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingId, setVotingId] = useState(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBoard(await getPublicOrganizationRoadmap(organizationToken, {
        query: search,
        status,
        sort,
        locationId: selectedLocationId,
        visitorId: visitorId(),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [organizationToken, search, selectedLocationId, sort, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadBoard, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadBoard, search]);

  async function handleVote(initiative, value) {
    const nextValue = initiative.viewer_vote === value ? null : value;
    setVotingId(initiative.id);
    setError("");
    try {
      const updated = await updatePublicOrganizationInitiativeVote(
        organizationToken,
        initiative.id,
        nextValue,
        visitorId()
      );
      setBoard((current) => current && ({
        ...current,
        initiatives: current.initiatives.map((item) => (
          item.id === updated.id ? updated : item
        )),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setVotingId(null);
    }
  }

  const initiatives = board?.initiatives || [];
  return (
    <>
      <section className="public-hub-filter-panel" aria-label="Roadmap search and filters">
        <LocationTabs locations={locations} selectedLocationId={selectedLocationId} onSelect={onSelectLocation} />
        <div className="board-toolbar">
          <label className="board-search">
            <span className="sr-only">Search initiatives</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search what we’re working on"
              type="search"
              value={search}
            />
          </label>
          <div className="board-sort" aria-label="Sort initiatives">
            {SORT_OPTIONS.map((option) => (
              <button
                className={sort === option.value ? "board-sort-button board-sort-button--active" : "board-sort-button"}
                key={option.value}
                onClick={() => setSort(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="board-filters" aria-label="Filter by status">
          {STATUS_OPTIONS.map((option) => (
            <button
              className={status === option.value ? "board-filter board-filter--active" : "board-filter"}
              key={option.value || "all"}
              onClick={() => setStatus(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      {error && <p className="message message--error board-request-error">{error}</p>}
      {loading ? (
        <p className="public-hub-state public-hub-panel">Refreshing initiatives…</p>
      ) : initiatives.length ? (
        <div className="initiative-list">
          {initiatives.map((initiative) => (
            <article className="public-initiative-card" key={initiative.id}>
              <div className="initiative-votes" aria-label={`${initiative.score} vote score`}>
                <button
                  aria-label={`Upvote ${initiative.title}`}
                  aria-pressed={initiative.viewer_vote === 1}
                  className={initiative.viewer_vote === 1 ? "initiative-vote-button initiative-vote-button--active" : "initiative-vote-button"}
                  disabled={votingId === initiative.id}
                  onClick={() => handleVote(initiative, 1)}
                  type="button"
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <strong className="initiative-score">{scoreLabel(initiative.score)}</strong>
                <button
                  aria-label={`Downvote ${initiative.title}`}
                  aria-pressed={initiative.viewer_vote === -1}
                  className={initiative.viewer_vote === -1 ? "initiative-vote-button initiative-vote-button--active initiative-vote-button--down" : "initiative-vote-button"}
                  disabled={votingId === initiative.id}
                  onClick={() => handleVote(initiative, -1)}
                  type="button"
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
                  <span>{initiative.location_name || "Organization-wide"}</span>
                  <span>Updated {relativeDate(initiative.updated_at)}</span>
                </div>
                <h2>{initiative.title}</h2>
                <p>{initiative.description}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="public-hub-empty public-hub-panel">
          <h2>{search || status ? "No matching initiatives" : "Nothing here just yet"}</h2>
          <p>{search || status ? "Try another search or status." : "Check back soon to see what this team is working on."}</p>
        </div>
      )}
      <p className="board-vote-note">Votes are anonymous and help this team understand what matters most.</p>
    </>
  );
}

function PublicLocations({ locations }) {
  return (
    <div className="public-location-list">
      {locations.map((location) => (
        <article className="public-location-card" key={location.id}>
          <span className="public-location-mark" aria-hidden="true">⌖</span>
          <div>
            <p className="public-location-kind">{location.is_default ? "Main location" : "Location"}</p>
            <h2>{location.name}</h2>
            <p>{location.address || "Address not provided"}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function LegacyRoadmapRedirect() {
  const { feedbackToken } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getFeedbackFormInfo(feedbackToken)
      .then((info) => {
        if (active) {
          navigate(`/five-star/${info.organization_token}?view=roadmap&location=${info.location_id}`, { replace: true });
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => { active = false; };
  }, [feedbackToken, navigate]);

  return (
    <div className="public-hub-page public-hub-page--centered">
      <p>{error || "Opening the organization page…"}</p>
    </div>
  );
}

export default function PublicOrganizationPage() {
  const { organizationToken } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getPublicOrganizationHub(organizationToken)
      .then((data) => {
        if (active) setHub(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [organizationToken]);

  const availableViews = useMemo(() => {
    if (!hub) return [];
    return [
      ...(hub.modules.feed ? ["feed"] : []),
      ...(hub.modules.roadmap ? ["roadmap"] : []),
      "locations",
    ];
  }, [hub]);
  const requestedView = searchParams.get("view");
  const view = availableViews.includes(requestedView) ? requestedView : availableViews[0];
  const requestedLocationId = Number(searchParams.get("location")) || null;
  const selectedLocationId = hub?.locations.some((location) => location.id === requestedLocationId)
    ? requestedLocationId
    : null;

  function updateView(nextView) {
    const next = new URLSearchParams(searchParams);
    next.set("view", nextView);
    if (!["feed", "roadmap"].includes(nextView)) next.delete("location");
    setSearchParams(next);
    setMenuOpen(false);
  }

  function updateLocation(nextLocationId) {
    const next = new URLSearchParams(searchParams);
    if (nextLocationId) next.set("location", String(nextLocationId));
    else next.delete("location");
    setSearchParams(next);
  }

  function openFeedback() {
    setMenuOpen(false);
    navigate(`/feedback/organization/${organizationToken}`);
  }

  if (loading) {
    return <div className="public-hub-page public-hub-page--centered"><p>Loading public page…</p></div>;
  }
  if (error || !hub) {
    return (
      <div className="public-hub-page public-hub-page--centered">
        <div className="board-state-card">
          <p className="board-eyebrow">Five Star</p>
          <h1>Public page not found</h1>
          <p>{error || "This organization does not have a public landing page enabled."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-hub-page">
      <header className="public-hub-header">
        <div className="public-hub-header-main">
          <h1>{hub.organization_name}</h1>
          <div className="public-hub-recognition" aria-describedby="five-star-recognition-help" aria-label={`${hub.five_star_status} Five Star ${hub.five_star_status === 1 ? "mark" : "marks"}`} tabIndex="0">
            {Array.from({ length: hub.five_star_status }, (_, index) => (
              <img className="public-hub-recognition-mark" src={ASTERISK_SRC} alt="" aria-hidden="true" key={index} />
            ))}
            <span className="public-hub-recognition-tooltip" id="five-star-recognition-help" role="tooltip">
              This organization has earned {hub.five_star_status} Five* {hub.five_star_status === 1 ? "mark" : "marks"} for listening to customers and acting on their feedback.
            </span>
          </div>
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close organization menu" : "Open organization menu"}
            className="public-hub-menu-toggle"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
        <nav className={menuOpen ? "public-hub-nav public-hub-nav--open" : "public-hub-nav"} aria-label="Organization page">
          {hub.modules.feed && (
            <button className={view === "feed" ? "public-hub-nav-item public-hub-nav-item--active" : "public-hub-nav-item"} onClick={() => updateView("feed")} type="button">Feed</button>
          )}
          {hub.modules.roadmap && (
            <button className={view === "roadmap" ? "public-hub-nav-item public-hub-nav-item--active" : "public-hub-nav-item"} onClick={() => updateView("roadmap")} type="button">Roadmap</button>
          )}
          <button className={view === "locations" ? "public-hub-nav-item public-hub-nav-item--active" : "public-hub-nav-item"} onClick={() => updateView("locations")} type="button">Locations</button>
          <button className="public-hub-feedback-action" onClick={openFeedback} type="button">Give feedback</button>
        </nav>
      </header>

      <section className="public-hub-content" aria-label="Organization content">
        {view === "feed" && <PublicFeed organizationToken={organizationToken} locations={hub.locations} selectedLocationId={selectedLocationId} onSelectLocation={updateLocation} />}
        {view === "roadmap" && <PublicRoadmap organizationToken={organizationToken} locations={hub.locations} selectedLocationId={selectedLocationId} onSelectLocation={updateLocation} />}
        {view === "locations" && <PublicLocations locations={hub.locations} />}
      </section>
      <footer className="public-hub-footer">
        <span>Powered by</span>
        <img src={LOGO_SRC} alt="five*" />
      </footer>
    </div>
  );
}
