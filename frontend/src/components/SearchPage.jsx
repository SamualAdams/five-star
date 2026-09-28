import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { List, LoaderCircle, Map as MapIcon, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { fetchMapPlaces, searchDirectory, searchOrganizations, submitUnlistedBusinessFeedback } from "../api";
import SearchMap, { mapView } from "./SearchMap";
import ClaimBusinessForm from "./ClaimBusinessForm";
import FiveStarRating from "./FiveStarRating";
import { ASTERISK_SRC, FIVE_STAR_LEVELS } from "../fiveStarLevels";

const SEARCH_DEBOUNCE_MS = 250;
// Below this width the page shows the list or the map, switched with a floating pill.
const MOBILE_QUERY = "(max-width: 900px)";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    // Some browsers (and viewport emulation) skip the change event; resize catches those.
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return isMobile;
}

// Roughly a few blocks around the person on a phone - enough to spot where they are.
const NEAR_ME_ZOOM = 16;

// Spelled out under the homepage's closing prompt, before anyone starts searching.
const HOW_IT_WORKS = [
  { title: "Find the business", description: "Search, or tap Near me." },
  { title: "Say what\u2019s on your mind", description: "Praise, a problem, or an idea. No account needed." },
  { title: "We take it to them", description: "Privately, to the people who can act on it." },
];

function distanceMiles(from, place) {
  if (!from || place.lat == null || place.lon == null) return null;
  const rad = Math.PI / 180;
  const dLat = (place.lat - from.lat) * rad;
  const dLon = (place.lon - from.lon) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(place.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

function formatDistance(miles) {
  if (miles == null) return null;
  if (miles < 0.1) return `${Math.max(50, Math.round((miles * 5280) / 50) * 50)} ft`;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

function formatPlaceAddress(place) {
  return [place.street, place.city, place.state].filter(Boolean).join(", ");
}

export default function SearchPage({ home = false, onStart }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [places, setPlaces] = useState([]);
  // Businesses dotted over the map before anyone searches.
  const [browsePlaces, setBrowsePlaces] = useState([]);
  const browseTimer = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const searchTimer = useRef(null);
  const latestSearch = useRef(0);
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [activePlaceId, setActivePlaceId] = useState(null);
  // Bumped when new results should be framed on the map (not for "search this area").
  const [fitKey, setFitKey] = useState(0);
  const [mapFocus, setMapFocus] = useState(null);
  // Bumped when the map's box changes, so it re-measures itself.
  const [mapResizeKey, setMapResizeKey] = useState(0);
  // Whether the person has moved the map since it was last framed for them; if so,
  // switching views or coming back from a form keeps their view instead of re-framing.
  const userMovedMap = useRef(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [searchedArea, setSearchedArea] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const isMobile = useIsMobile();
  // The homepage leads with the map; the plain search page leads with the list.
  const [mobileView, setMobileView] = useState(home ? "map" : "list");
  // The place whose pin was tapped on the mobile map, shown in a card over it.
  const [previewPlace, setPreviewPlace] = useState(null);
  const [claimPlace, setClaimPlace] = useState(null);
  // An owner asking us to list a business that isn't in the directory: { name } or null.
  const [listingRequest, setListingRequest] = useState(null);
  // Only show businesses five* rates at least this high (0 = any).
  const [minStars, setMinStars] = useState(0);
  const minStarsRef = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The homepage opens with its pitch and search floating over a dimmed map. Touching
  // the search, near me, or filters moves the search to the top and wakes the map.
  const [engaged, setEngaged] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showMissingBusinessForm, setShowMissingBusinessForm] = useState(false);
  const isFormOpen = showMissingBusinessForm || Boolean(claimPlace) || Boolean(listingRequest);
  // A form replaces the map, so the page must scroll normally again.
  const showingMap = isMobile && mobileView === "map" && !isFormOpen;
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

  function handleSearch(searchQuery) {
    setQuery(searchQuery);
    clearTimeout(searchTimer.current);

    if (!searchQuery || searchQuery.trim().length < 2) {
      if (userLocation || minStarsRef.current) {
        // Nothing typed, but near me or a rating filter is on: list those businesses.
        setIsSearching(true);
        searchTimer.current = setTimeout(() => runSearch("", { near: userLocation }), SEARCH_DEBOUNCE_MS);
        return;
      }
      latestSearch.current += 1;
      setResults([]);
      setPlaces([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimer.current = setTimeout(() => runSearch(searchQuery, { near: userLocation }), SEARCH_DEBOUNCE_MS);
  }

  async function runSearch(searchQuery, { inArea = false, near = null, fit = !inArea } = {}) {
    const searchId = ++latestSearch.current;
    // Rank closest to the person when we know where they are, otherwise to what
    // the map shows; "search this area" also limits to the map.
    const view = mapRef.current ? mapView(mapRef.current) : null;
    const hasText = searchQuery.trim().length >= 2;
    const minStars = minStarsRef.current;
    const [orgs, directoryPlaces] = await Promise.all([
      hasText ? searchOrganizations(searchQuery, { minStars }).catch(() => []) : [],
      searchDirectory(searchQuery, {
        center: near ?? view?.center,
        bbox: inArea ? view?.bbox : undefined,
        minStars,
      }).catch(() => []),
    ]);
    // A slower, older request must not overwrite results for what's typed now.
    if (searchId !== latestSearch.current) return;
    setResults(orgs);
    setPlaces(directoryPlaces);
    setPreviewPlace(null);
    setHasSearched(true);
    setIsSearching(false);
    setMapMoved(false);
    setSearchedArea(inArea);
    if (fit) {
      userMovedMap.current = false;
      setFitKey((key) => key + 1);
    }
  }

  function changeMinStars(stars) {
    minStarsRef.current = stars;
    setMinStars(stars);
    setFiltersOpen(false);
    clearTimeout(searchTimer.current);
    if (query.trim().length >= 2 || userLocation || stars) {
      setIsSearching(true);
      runSearch(query, { near: userLocation });
    } else {
      latestSearch.current += 1;
      setResults([]);
      setPlaces([]);
      setHasSearched(false);
      setIsSearching(false);
    }
  }

  function searchThisArea() {
    if (query.trim().length < 2 && !userLocation && !minStars) return;
    clearTimeout(searchTimer.current);
    setIsSearching(true);
    runSearch(query, { inArea: true });
  }

  function handleMapMove() {
    userMovedMap.current = true;
    if (query.trim().length >= 2 || userLocation || minStars) setMapMoved(true);
    clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(loadBrowsePlaces, 350);
  }

  async function loadBrowsePlaces() {
    if (!mapRef.current) return;
    const pins = await fetchMapPlaces(mapView(mapRef.current).bbox).catch(() => null);
    if (pins) setBrowsePlaces(pins);
  }

  // Leaflet measures its container once; tell it when the mobile map is shown. Frame the
  // person's location or results then - unless they've moved the map themselves.
  useEffect(() => {
    if (!showingMap || !mapRef.current) return;
    setMapResizeKey((key) => key + 1);
    if (userMovedMap.current) return;
    if (userLocation && query.trim().length < 2) {
      setMapFocus({ ...userLocation, zoom: NEAR_ME_ZOOM });
    } else if (places.length > 0) {
      setFitKey((key) => key + 1);
    }
  }, [showingMap]);

  function handlePinSelect(place) {
    if (isMobile) {
      setPreviewPlace(place);
      setActivePlaceId(place.id);
    } else {
      openPlaceFeedbackForm(place);
    }
  }

  function searchNearMe() {
    setEngaged(true);
    if (!navigator.geolocation) {
      setLocationError("Your browser can’t share its location.");
      return;
    }
    setIsLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const near = { lat: position.coords.latitude, lon: position.coords.longitude };
        const hasText = query.trim().length >= 2;
        setUserLocation(near);
        setIsLocating(false);
        // "Where am I?" - zoom in around them and show the map, rather than fit
        // every result. With a name typed, frame the closest matches instead.
        if (!hasText) {
          userMovedMap.current = false;
          setMapFocus({ ...near, zoom: NEAR_ME_ZOOM });
          setMobileView("map");
        }
        clearTimeout(searchTimer.current);
        setIsSearching(true);
        runSearch(query, { near, fit: hasText });
      },
      (error) => {
        setIsLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location is turned off for this site. You can still search by name or road."
            : "We couldn’t find your location. Try again, or search by name or road."
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function openMissingBusinessForm() {
    setSelectedPlace(null);
    setMissingBusiness((current) => ({
      ...current,
      business_name: current.business_name || query.trim(),
    }));
    setMissingBusinessError("");
    setMissingBusinessSubmitted(false);
    setShowMissingBusinessForm(true);
  }

  function openListingRequest() {
    setShowMissingBusinessForm(false);
    setListingRequest({ name: missingBusiness.business_name || query.trim() });
  }

  function openPlaceFeedbackForm(place) {
    setSelectedPlace(place);
    setMissingBusiness((current) => ({
      ...current,
      business_name: place.name,
      location_hint: formatPlaceAddress(place) || place.name,
    }));
    setMissingBusinessError("");
    setMissingBusinessSubmitted(false);
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
        directory_place_id: selectedPlace?.id,
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
    return () => {
      clearTimeout(searchTimer.current);
      clearTimeout(browseTimer.current);
    };
  }, []);

  // Once someone starts looking, the big heading just pushes results off-screen.
  const isActive =
    (home && engaged) || query.trim().length > 0 || hasSearched || Boolean(userLocation) || minStars > 0;
  const isIntro = home && !isActive && !isFormOpen && (!isMobile || mobileView === "map");

  // On the homepage, starting a search leaves the story behind for good (HomePage).
  useEffect(() => {
    if (home && isActive) onStart?.();
  }, [home, isActive]);

  // Forms open from partway down the results (or the bottom of the homepage); start at the form.
  useEffect(() => {
    if (isFormOpen) containerRef.current?.scrollIntoView({ block: "start" });
  }, [isFormOpen]);

  // Leaving the intro resizes the map (sidebar on desktop, search bar on phones).
  useEffect(() => {
    if (!mapRef.current) return;
    setMapResizeKey((key) => key + 1);
    loadBrowsePlaces();
  }, [isIntro]);

  return (
    <div
      id={home ? "give-feedback" : undefined}
      className={`search-page${home ? " search-page--home" : ""}${isIntro ? " search-page--intro" : ""}${isActive ? " search-page--active" : ""}${showingMap ? " search-page--map-view" : ""}`}
    >
      <div className="search-container" ref={containerRef}>
        <div className="search-hero">
        <h1 className="search-title">
          {home ? "Give them feedback before it\u2019s too late." : "Who do you want to reach?"}
        </h1>
        {!home && (
          <p className="search-subtitle">Search by business name, road, or location. No account required.</p>
        )}

        <div className="search-controls">
        <div className="search-box">
          <div className="search-input-wrap">
            <Search className="search-input-icon" size={20} aria-hidden="true" />
            <input
              type="text"
              aria-label="Search businesses"
              className="search-input search-input--pill"
              placeholder={home ? "Find a business" : "Business name, road, or place..."}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setEngaged(true)}
              autoFocus={!home}
            />
            {isSearching && <div className="search-spinner">Searching...</div>}
          </div>
          <button
            type="button"
            className={`search-circle-button${userLocation ? " search-circle-button--on" : ""}`}
            onClick={searchNearMe}
            disabled={isLocating}
            aria-label="Search near me"
            title="Search near me"
          >
            {isLocating ? <LoaderCircle size={20} className="search-near-me-spin" /> : <MapPin size={20} />}
          </button>
          <button
            type="button"
            className={`search-circle-button${filtersOpen || minStars ? " search-circle-button--on" : ""}`}
            onClick={() => {
              setEngaged(true);
              setFiltersOpen((open) => !open);
            }}
            aria-expanded={filtersOpen}
            aria-controls="search-star-filter"
            aria-label={minStars ? `Filters: rated ${minStars}${minStars < 5 ? "+" : ""}` : "Filters"}
            title="Filter by five* rating"
          >
            <SlidersHorizontal size={20} />
            {minStars > 0 && (
              <span className="search-circle-badge" aria-hidden="true">
                {minStars}
                {minStars < 5 && "+"}
              </span>
            )}
          </button>
        </div>
        {locationError && <p className="search-location-error">{locationError}</p>}

        {!isFormOpen && filtersOpen && (
          <div className="search-star-filter" id="search-star-filter" role="group" aria-label="Filter by five* rating">
            {[0, 1, 2, 3, 4, 5].map((stars) => (
              <button
                key={stars}
                type="button"
                className={`search-star-chip${minStars === stars ? " search-star-chip--active" : ""}`}
                aria-pressed={minStars === stars}
                title={stars ? `${FIVE_STAR_LEVELS[stars].title}${stars < 5 ? " or higher" : ""}` : "Every business"}
                onClick={() => changeMinStars(stars)}
              >
                {stars === 0 ? (
                  <>
                    Any
                    <img src={ASTERISK_SRC} alt="" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    {stars}
                    {stars < 5 && "+"}
                    <img src={ASTERISK_SRC} alt="" aria-hidden="true" />
                  </>
                )}
              </button>
            ))}
          </div>
        )}
        </div>

        {isIntro && (
          <ol className="search-steps" aria-label="How it works">
            {HOW_IT_WORKS.map((step, index) => (
              <li className="search-step" key={step.title}>
                <span className="search-step-number" aria-hidden="true">{`0${index + 1}`}</span>
                <span className="search-step-text">
                  <strong>{step.title}</strong>
                  {step.description}
                </span>
              </li>
            ))}
          </ol>
        )}
        </div>

        <div
          className={`search-layout${showMissingBusinessForm || claimPlace || listingRequest ? " search-layout--hidden" : ""}${
            showingMap ? " search-layout--map-view" : ""
          }`}
        >
        <div className="search-layout-list">
        {hasSearched && !isSearching && !showMissingBusinessForm && (
          <div className="search-results">
            {results.length + places.length > 0 ? (
              <>
                <div className="search-results-header">
                  <p className="search-results-count">
                    Found {results.length + places.length} business
                    {results.length + places.length !== 1 ? "es" : ""}
                    {minStars > 0 && ` rated ${minStars}${minStars < 5 ? "+" : ""}`}
                    {searchedArea ? " in this area" : userLocation && " near you"}
                  </p>
                  <button className="search-missing-link search-missing-link--top" type="button" onClick={openMissingBusinessForm}>
                    Can&apos;t find the exact business or location?
                  </button>
                </div>
                <ul className="search-results-list">
                  {results.map((org) => (
                    <li key={org.feedback_token} className="search-result-item">
                      <div className="search-result-card">
                        <div className="search-result-text">
                          <span className="search-result-name">{org.name}</span>
                          <FiveStarRating stars={org.five_star_status} />
                        </div>
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
                  {places.map((place) => (
                    <li
                      key={`place-${place.id}`}
                      className="search-result-item"
                      onMouseEnter={() => setActivePlaceId(place.id)}
                      onMouseLeave={() => setActivePlaceId(null)}
                    >
                      <div
                        className={`search-result-card search-result-card--place${
                          place.id === activePlaceId ? " search-result-card--active" : ""
                        }`}
                      >
                        <div className="search-result-text">
                          <span className="search-result-name">{place.name}</span>
                          <FiveStarRating stars={place.five_star_status} />
                          {(formatPlaceAddress(place) || userLocation) && (
                            <span className="search-result-address">
                              {[formatDistance(distanceMiles(userLocation, place)), formatPlaceAddress(place)]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </div>
                        {!place.claimed && (
                          <button className="search-claim-link" type="button" onClick={() => setClaimPlace(place)}>
                            Own this business? Claim it
                          </button>
                        )}
                        <div className="search-result-actions">
                          <button className="btn btn--primary btn--sm" type="button" onClick={() => openPlaceFeedbackForm(place)}>
                            Leave feedback
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : minStars > 0 ? (
              <div className="search-missing-card">
                <h2>No businesses rated {minStars}{minStars < 5 && "+"} yet</h2>
                <p>
                  Most businesses haven&apos;t been rated by five* yet. Show every rating to see them all.
                </p>
                <button className="btn btn--primary" type="button" onClick={() => changeMinStars(0)}>
                  Show all ratings
                </button>
              </div>
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
                <button className="search-owner-link" type="button" onClick={openListingRequest}>
                  Own this business? Get it listed
                </button>
              </div>
            )}
          </div>
        )}

        {hasSearched && !isSearching && results.length + places.length > 0 && !showMissingBusinessForm && (
          <button className="search-missing-link" type="button" onClick={openMissingBusinessForm}>
            Can&apos;t find the exact business or location?
          </button>
        )}

        {!hasSearched && (
          <div className="search-hint">
            <ol className="search-hint-steps">
              <li><strong>Find it.</strong> Tap a dot on the map, search, or use <em>Near me</em>.</li>
              <li><strong>Say it.</strong> Praise, concern, or idea. Stay anonymous if you like.</li>
              <li><strong>We deliver it.</strong> Privately, to the people who can act on it.</li>
              <li className="search-hint-legend">
                <span className="search-hint-dot search-hint-dot--rated" aria-hidden="true" />
                Darker dots are businesses already listening on five*.
              </li>
            </ol>
            <Link className="search-hint-link" to="/about">Why five* exists →</Link>
          </div>
        )}
        </div>

        <div className="search-layout-map">
          <SearchMap
            places={hasSearched ? places : browsePlaces}
            compact={!hasSearched}
            userLocation={userLocation}
            activeId={activePlaceId}
            fitKey={fitKey}
            focus={mapFocus}
            resizeKey={mapResizeKey}
            onHover={setActivePlaceId}
            onSelect={handlePinSelect}
            showTooltips={!isMobile}
            onBackgroundClick={() => {
              setPreviewPlace(null);
              if (isMobile) setActivePlaceId(null);
            }}
            onReady={(map) => {
              mapRef.current = map;
              loadBrowsePlaces();
            }}
            onUserMove={handleMapMove}
          />
          {mapMoved && !isSearching && (
            <button className="search-map-area-button" type="button" onClick={searchThisArea}>
              Search this area
            </button>
          )}
          {showingMap && previewPlace && (
            <div className="search-map-preview">
              <div className="search-result-text">
                <span className="search-result-name">{previewPlace.name}</span>
                <FiveStarRating stars={previewPlace.five_star_status} />
                <span className="search-result-address">
                  {[formatDistance(distanceMiles(userLocation, previewPlace)), formatPlaceAddress(previewPlace)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {!previewPlace.claimed && (
                  <button className="search-claim-link" type="button" onClick={() => setClaimPlace(previewPlace)}>
                    Own this business? Claim it
                  </button>
                )}
              </div>
              <button className="btn btn--primary btn--sm" type="button" onClick={() => openPlaceFeedbackForm(previewPlace)}>
                Leave feedback
              </button>
            </div>
          )}
        </div>
        </div>

        {isMobile && !isFormOpen && (
          <div className="search-mobile-actions">
            <button
              className="search-view-toggle"
              type="button"
              onClick={() => setMobileView(showingMap ? "list" : "map")}
              aria-label={showingMap ? "Switch to list" : "Switch to map"}
            >
              {showingMap ? <List size={18} /> : <MapIcon size={18} />}
              <span>{showingMap ? "List" : "Map"}</span>
            </button>
            {showingMap && (
              <button className="search-map-cant-find" type="button" onClick={openMissingBusinessForm}>
                Can&apos;t find it?
              </button>
            )}
          </div>
        )}

        {claimPlace && (
          <ClaimBusinessForm
            key={claimPlace.id}
            place={claimPlace}
            address={formatPlaceAddress(claimPlace)}
            onBack={() => setClaimPlace(null)}
          />
        )}

        {listingRequest && (
          <ClaimBusinessForm initialName={listingRequest.name} onBack={() => setListingRequest(null)} />
        )}

        {showMissingBusinessForm && (
          <section className="search-missing-form-card" aria-labelledby="missing-business-title">
            {missingBusinessSubmitted ? (
              <div className="search-missing-success">
                <p className="section-kicker">We&apos;ve got it</p>
                <h2 id="missing-business-title">We&apos;ll take it from here.</h2>
                <p>
                  {selectedPlace
                    ? `We'll make sure ${selectedPlace.name} gets your feedback.`
                    : "We'll find the business, identify the right location, and make sure your feedback gets where it belongs."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleMissingBusinessSubmit}>
                {selectedPlace ? (
                  <>
                    <p className="section-kicker">Leave feedback</p>
                    <h2 id="missing-business-title">{selectedPlace.name}</h2>
                    <p className="search-missing-intro">
                      {formatPlaceAddress(selectedPlace)}
                      {formatPlaceAddress(selectedPlace) && <br />}
                      This business isn&apos;t on five* yet. Share what&apos;s on your mind and
                      we&apos;ll make sure it reaches them.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="section-kicker">Not in the catalog yet</p>
                    <h2 id="missing-business-title">Tell us what you know.</h2>
                    <p className="search-missing-intro">
                      A business does not need to be listed for you to speak. Give us enough detail to
                      find it, then share what is on your mind.
                    </p>
                    <p className="search-missing-owner">
                      Own this business?{" "}
                      <button className="search-owner-link search-owner-link--inline" type="button" onClick={openListingRequest}>
                        Get it listed instead
                      </button>
                    </p>
                  </>
                )}

                {!selectedPlace && (
                  <>
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
                  </>
                )}

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

      </div>
    </div>
  );
}
