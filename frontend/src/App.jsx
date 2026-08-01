import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AUTH_SESSION_EXPIRED_EVENT,
  getFeedbackStats,
  listLocations,
  listOrganizationInitiatives,
  listOrganizations,
  listSocialPosts,
  me,
} from "./api";
import AuthPage from "./components/AuthPage";
import BrandName from "./components/BrandName";
import CreateOrgModal from "./components/CreateOrgModal";
import DigestManager from "./components/DigestManager";
import DigestsPage from "./components/DigestsPage";
import FeedbackPage from "./components/FeedbackPage";
import FeedPage from "./components/FeedPage";
import InviteAcceptPage from "./components/InviteAcceptPage";
import InitiativesManager from "./components/InitiativesManager";
import MarketingPage from "./components/MarketingPage";
import LocationsPage from "./components/LocationsPage";
import LocationSwitcher from "./components/LocationSwitcher";
import ModuleLockedPage from "./components/ModuleLockedPage";
import OrganizationSwitcher from "./components/OrganizationSwitcher";
import OrgSettingsPage from "./components/OrgSettingsPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import SearchPage from "./components/SearchPage";
import SubmissionsChart from "./components/SubmissionsChart";
import TopbarSearch from "./components/TopbarSearch";
import VotingBoardPage from "./components/VotingBoardPage";

const TOKEN_KEY = "five-star-token";
const CURRENT_ORG_KEY = "five-star-current-org";
const CURRENT_LOCATION_PREFIX = "five-star-current-location";
const SIDEBAR_KEY = "five-star-sidebar-open";
const LOGO_SRC = `${import.meta.env.BASE_URL}brand/five-star-logo.svg`;
const ASTERISK_SRC = `${import.meta.env.BASE_URL}brand/five-star-asterisk.svg`;
const ACCESS_ROLE_LABELS = {
  organization_admin: "Organization admin",
  organization_viewer: "Organization viewer",
  location_admin: "Location admin",
  location_viewer: "Location viewer",
};

function accessRoleLabel(role) {
  return ACCESS_ROLE_LABELS[role] || role || "Member";
}

const JOURNEY_MILESTONES = [
  {
    title: "Start your journey",
    description: "Create an account and log in to Five Star.",
  },
  {
    title: "Collect and report",
    description: "Collect 10 feedback submissions and publish a feedback report.",
  },
  {
    title: "Share your roadmap",
    description: "Publish initiatives and use the roadmap to show what you’re working on.",
  },
  {
    title: "Earn a 4.8+ reputation",
    description: "Maintain a 4.8 or higher average across your connected review boards.",
  },
  {
    title: "Earn a Five Star recognition",
    description: "Qualify for the annual Five Star recognitions, with opportunities for free advertising and public voting.",
  },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentLocationId, setCurrentLocationId] = useState("all");
  const [currentOrgId, setCurrentOrgId] = useState(() => {
    const saved = localStorage.getItem(CURRENT_ORG_KEY);
    return saved ? Number(saved) : null;
  });
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const locationRequestIdRef = useRef(0);
  const [isMenuOpen, setIsMenuOpen] = useState(() => {
    if (window.innerWidth <= 900) return false;
    return localStorage.getItem(SIDEBAR_KEY) !== "false";
  });
  const clearSession = useCallback(() => {
    locationRequestIdRef.current += 1;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CURRENT_ORG_KEY);
    setToken("");
    setUser(null);
    setOrganizations([]);
    setLocations([]);
    setCurrentOrgId(null);
    setCurrentLocationId("all");
    setIsMenuOpen(false);
  }, []);

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);
  const routeOrgId = useMemo(
    () => Number(location.pathname.match(/^\/org\/(\d+)/)?.[1]) || null,
    [location.pathname]
  );
  const currentOrg = useMemo(
    () => (
      routeOrgId
        ? organizations.find((organization) => organization.id === routeOrgId) || null
        : organizations.find((organization) => organization.id === currentOrgId) || organizations[0] || null
    ),
    [organizations, currentOrgId, routeOrgId]
  );
  const currentLocation = useMemo(
    () => locations.find(
      (item) => item.id === Number(currentLocationId) && item.organization_id === currentOrg?.id
    ) || null,
    [locations, currentLocationId, currentOrg?.id]
  );
  const selectedLocationId = currentLocation?.id || null;
  const locationScopeLabel = currentLocationId === "all"
    ? "All locations"
    : currentLocation?.name || "All locations";
  const canManageCurrentLocation = Boolean(currentOrg?.can_manage_organization) || Boolean(currentLocation?.can_manage);
  const isAppRoute = location.pathname === "/dashboard" || location.pathname.startsWith("/org/");

  const loadOrganizations = useCallback(
    async (authToken) => {
      try {
        const orgs = await listOrganizations(authToken || token);
        setOrganizations(orgs);
        if (orgs.length && !orgs.find((o) => o.id === currentOrgId)) {
          setCurrentOrgId(orgs[0].id);
          localStorage.setItem(CURRENT_ORG_KEY, String(orgs[0].id));
        }
        return orgs;
      } catch {
        return [];
      }
    },
    [token, currentOrgId]
  );

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        setOrganizations([]);
        return;
      }
      try {
        const currentUser = await me(token);
        setUser(currentUser);
        await loadOrganizations(token);
      } catch {
        clearSession();
      }
    }
    loadUser();
  }, [token, loadOrganizations, clearSession]);

  useEffect(() => {
    function handleSessionExpired() {
      clearSession();
      navigate("/auth?mode=login&reason=session-expired", { replace: true });
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [clearSession, navigate]);

  useEffect(() => {
    if (window.innerWidth <= 900) setIsMenuOpen(false);
  }, [location.pathname, isAuthenticated]);

  useEffect(() => {
    if (!routeOrgId) return;
    const routeOrganization = organizations.find((organization) => organization.id === routeOrgId);
    if (routeOrganization && routeOrgId !== currentOrgId) {
      locationRequestIdRef.current += 1;
      setCurrentOrgId(routeOrgId);
      localStorage.setItem(CURRENT_ORG_KEY, String(routeOrgId));
      setLocations([]);
      setCurrentLocationId("all");
    } else if (user && organizations.length > 0 && !routeOrganization) {
      navigate("/dashboard", { replace: true });
    }
  }, [routeOrgId, organizations, currentOrgId, navigate, user]);

  const loadCurrentLocations = useCallback(async () => {
    const requestId = ++locationRequestIdRef.current;
    if (!token || !currentOrg?.id) {
      if (requestId === locationRequestIdRef.current) setLocations([]);
      return [];
    }
    try {
      const availableLocations = await listLocations(token, currentOrg.id);
      if (requestId !== locationRequestIdRef.current) return [];
      setLocations(availableLocations);
      const storageKey = `${CURRENT_LOCATION_PREFIX}-${currentOrg.id}`;
      const saved = localStorage.getItem(storageKey);
      const savedLocationId = Number(saved);
      let nextScope;
      if (saved === "all" && currentOrg.can_view_all_locations) {
        nextScope = "all";
      } else if (savedLocationId && availableLocations.some((item) => item.id === savedLocationId)) {
        nextScope = savedLocationId;
      } else if (currentOrg.can_view_all_locations) {
        nextScope = "all";
      } else {
        nextScope = availableLocations[0]?.id || "all";
      }
      setCurrentLocationId(nextScope);
      localStorage.setItem(storageKey, String(nextScope));
      return availableLocations;
    } catch {
      if (requestId === locationRequestIdRef.current) setLocations([]);
      return [];
    }
  }, [token, currentOrg?.id, currentOrg?.can_view_all_locations]);

  useEffect(() => {
    loadCurrentLocations();
  }, [loadCurrentLocations]);

  function handleOrgChange(orgId) {
    locationRequestIdRef.current += 1;
    setCurrentOrgId(orgId);
    localStorage.setItem(CURRENT_ORG_KEY, String(orgId));
    setLocations([]);
    setCurrentLocationId("all");
    navigate("/dashboard");
  }

  function handleLocationChange(locationId) {
    setCurrentLocationId(locationId);
    if (currentOrg) {
      localStorage.setItem(`${CURRENT_LOCATION_PREFIX}-${currentOrg.id}`, String(locationId));
    }
  }

  function handleOrgCreated(org) {
    locationRequestIdRef.current += 1;
    setOrganizations((prev) => [...prev, org]);
    setCurrentOrgId(org.id);
    localStorage.setItem(CURRENT_ORG_KEY, String(org.id));
    setShowCreateOrg(false);
    navigate("/dashboard");
  }

  function handleAuthenticated(accessToken, currentUser) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setUser(currentUser);
  }

  function logout() {
    clearSession();
  }

  function handleLocationUpdated(updatedLocation) {
    setLocations((current) => current.map(
      (item) => (item.id === updatedLocation.id ? updatedLocation : item)
    ));
  }

  function handleOrganizationUpdated(updatedOrganization) {
    setOrganizations((current) => current.map(
      (item) => (item.id === updatedOrganization.id ? updatedOrganization : item)
    ));
  }

  function toggleSidebar() {
    setIsMenuOpen((current) => {
      const next = !current;
      if (window.innerWidth > 900) localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  const hasAppShell = isAuthenticated && isAppRoute;

  return (
    <div className={`layout ${hasAppShell ? "layout--app" : "layout--public"}${hasAppShell && !isMenuOpen ? " layout--sidebar-closed" : ""}`}>
      {hasAppShell ? (
        <AppHeader />
      ) : (
        <PublicHeader isAuthenticated={isAuthenticated} />
      )}

      {hasAppShell && (
        <AppSidebar
          currentOrg={currentOrg}
          currentOrgId={currentOrg?.id}
          currentLocationId={currentLocationId}
          isOpen={isMenuOpen}
          locations={locations}
          onClose={() => setIsMenuOpen(false)}
          onLogout={logout}
          onOrgChange={handleOrgChange}
          onLocationChange={handleLocationChange}
          onShowCreateOrg={() => setShowCreateOrg(true)}
          onToggle={toggleSidebar}
          organizations={organizations}
          user={user}
        />
      )}

      <main className={`app-main ${hasAppShell ? "app-main--app" : "app-main--public"}`}>
        {token && !user ? (
          <div className="route-loading" role="status">
            Loading your workspace…
          </div>
        ) : (
          <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <MarketingPage />}
          />
          <Route
            path="/auth"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <AuthPage
                  loadOrganizations={loadOrganizations}
                  onAuthenticated={handleAuthenticated}
                />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <Dashboard
                  currentOrg={currentOrg}
                  isSuperuser={Boolean(user?.is_superuser)}
                  locationId={selectedLocationId}
                  organizations={organizations}
                  onShowCreateOrg={() => setShowCreateOrg(true)}
                  token={token}
                />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/roadmap"
            element={
              isAuthenticated ? (
                currentOrg?.modules?.roadmap === false ? (
                  <ModuleLockedPage isSuperuser={Boolean(user?.is_superuser)} moduleName="Roadmap" orgId={currentOrg.id} />
                ) : (
                  <VotingBoardAdminPage
                    token={token}
                    currentOrg={currentOrg}
                    currentLocation={currentLocation}
                    locationId={selectedLocationId}
                    locations={locations}
                    canManage={canManageCurrentLocation}
                  />
                )
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/board"
            element={
              isAuthenticated ? (
                currentOrg?.modules?.roadmap === false ? (
                  <ModuleLockedPage isSuperuser={Boolean(user?.is_superuser)} moduleName="Roadmap" orgId={currentOrg.id} />
                ) : (
                  <VotingBoardAdminPage
                    token={token}
                    currentOrg={currentOrg}
                    currentLocation={currentLocation}
                    locationId={selectedLocationId}
                    locations={locations}
                    canManage={canManageCurrentLocation}
                  />
                )
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/feedback"
            element={
              isAuthenticated ? (
                <FeedbackReportsPage
                  token={token}
                  currentOrg={currentOrg}
                  currentLocation={currentLocation}
                  locationId={selectedLocationId}
                  canManage={canManageCurrentLocation}
                />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/reports"
            element={
              isAuthenticated ? (
                <FeedbackReportsPage
                  token={token}
                  currentOrg={currentOrg}
                  currentLocation={currentLocation}
                  locationId={selectedLocationId}
                  canManage={canManageCurrentLocation}
                />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/feed"
            element={
              isAuthenticated ? (
                currentOrg?.modules?.feed === false ? (
                  <ModuleLockedPage isSuperuser={Boolean(user?.is_superuser)} moduleName="Feed" orgId={currentOrg.id} />
                ) : (
                  <FeedPage
                    token={token}
                    orgId={currentOrg?.id}
                    organizationName={currentOrg?.name}
                  />
                )
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/settings"
            element={
              isAuthenticated ? (
                <OrgSettingsPage
                  token={token}
                  user={user}
                  section="general"
                  currentLocation={currentLocation}
                  onOrganizationUpdated={handleOrganizationUpdated}
                  onLocationUpdated={handleLocationUpdated}
                />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/users"
            element={
              isAuthenticated ? (
                <OrgSettingsPage token={token} user={user} section="users" locations={locations} />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/invites"
            element={
              isAuthenticated ? (
                <Navigate to={`/org/${currentOrg?.id}/users`} replace />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/reviews"
            element={
              isAuthenticated ? (
                <OrgSettingsPage
                  token={token}
                  user={user}
                  section="reviews"
                  currentLocation={currentLocation}
                  canManageLocation={canManageCurrentLocation}
                  onLocationUpdated={handleLocationUpdated}
                />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/locations"
            element={
              !isAuthenticated ? (
                <Navigate to="/auth?mode=login" replace />
              ) : !currentOrg ? (
                <div className="route-loading" role="status">Loading locations…</div>
              ) : currentOrg.can_manage_organization ? (
                  <LocationsPage
                    token={token}
                    orgId={currentOrg.id}
                    locations={locations}
                    roadmapEnabled={currentOrg?.modules?.roadmap !== false}
                    onLocationsChanged={loadCurrentLocations}
                  />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/org/:id/social"
            element={
              isAuthenticated ? (
                currentOrg?.modules?.feed === false ? (
                  <ModuleLockedPage isSuperuser={Boolean(user?.is_superuser)} moduleName="Feed" orgId={currentOrg.id} />
                ) : (
                  <OrgSettingsPage token={token} user={user} section="social" />
                )
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/invite/:inviteToken"
            element={<InviteAcceptPage token={token} isAuthenticated={isAuthenticated} />}
          />
          <Route
            path="/org/:id/digests"
            element={
              isAuthenticated ? (
                <DigestsPage token={token} />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/feedback/:feedbackToken" element={<FeedbackPage />} />
          <Route path="/roadmap/:feedbackToken" element={<VotingBoardPage />} />
          <Route path="/board/:feedbackToken" element={<VotingBoardPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
          </Routes>
        )}
      </main>

      {showCreateOrg && (
        <CreateOrgModal
          token={token}
          onCreated={handleOrgCreated}
          onClose={organizations.length > 0 ? () => setShowCreateOrg(false) : undefined}
        />
      )}
    </div>
  );
}

function PublicHeader({ isAuthenticated }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="topbar topbar--public">
      <Link className="brand-lockup" to={isAuthenticated ? "/dashboard" : "/"}>
        <img className="topbar-logo" src={LOGO_SRC} alt="five*" />
        <span className="brand-tag">Built in Baton Rouge, serving businesses across Louisiana</span>
      </Link>

      {/* Right side — search always visible, nav toggles per breakpoint */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <TopbarSearch />

        {/* Desktop nav */}
        <div className="public-nav">
          {isAuthenticated ? (
            <Link className="btn btn--primary btn--sm" to="/dashboard">
              Dashboard
            </Link>
          ) : (
            <>
              <Link className="btn btn--ghost btn--sm" to="/auth?mode=login">
                Log in
              </Link>
              <Link className="btn btn--primary btn--sm" to="/auth?mode=signup">
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="menu-wrap public-menu-wrap">
        <button
          type="button"
          className="hamburger"
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((v) => !v)}
        >
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
        </button>

        <div className={`menu-panel ${isMenuOpen ? "menu-panel--open" : ""}`}>
          <div className="menu-section">
            {isAuthenticated ? (
              <Link className="menu-item" to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link className="menu-item" to="/auth?mode=signup" onClick={() => setIsMenuOpen(false)}>
                  Get started
                </Link>
                <Link className="menu-item" to="/auth?mode=login" onClick={() => setIsMenuOpen(false)}>
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </header>
  );
}

function AppHeader() {
  return (
    <header className="topbar topbar--app">
      <div className="app-journey" role="group" aria-label="Five Star journey">
        {JOURNEY_MILESTONES.map((milestone, index) => (
          <span
            aria-label={`${milestone.title}. ${milestone.description}`}
            aria-describedby={`journey-tooltip-${index}`}
            className={`app-journey-star-wrap${index === 0 ? " app-journey-star-wrap--earned" : ""}`}
            key={milestone.title}
            role="img"
            tabIndex="0"
          >
            <span
              className="app-journey-star"
              aria-hidden="true"
              style={{ "--journey-asterisk": `url("${ASTERISK_SRC}")` }}
            />
            <span className="app-journey-tooltip" id={`journey-tooltip-${index}`} role="tooltip">
              <strong>{milestone.title}</strong>
              <span>{milestone.description}</span>
            </span>
          </span>
        ))}
      </div>
    </header>
  );
}

function SidebarIcon({ name }) {
  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    board: (
      <>
        <path d="M9 18h6M10 22h4" />
        <path d="M8.5 14.5A7 7 0 1 1 15.5 14.5c-.8.6-1.5 1.4-1.7 2.5h-3.6c-.2-1.1-.9-1.9-1.7-2.5Z" />
      </>
    ),
    reports: (
      <>
        <path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </>
    ),
    feed: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    invite: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6M18 2v6M15 5h6" />
      </>
    ),
    review: (
      <path d="m12 2 3.1 6.3 6.9 1-5 4.8 1.2 6.9-6.2-3.3L5.8 21 7 14.1l-5-4.8 6.9-1L12 2Z" />
    ),
    social: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  };
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function AppSidebar({
  currentOrg,
  currentOrgId,
  currentLocationId,
  isOpen,
  locations,
  onClose,
  onLogout,
  onLocationChange,
  onOrgChange,
  onShowCreateOrg,
  onToggle,
  organizations,
  user,
}) {
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(true);
  const closeOnMobile = () => {
    if (window.innerWidth <= 900) onClose();
  };
  const orgBase = currentOrg ? `/org/${currentOrg.id}` : "";
  const selectedLocation = locations.find(
    (location) => location.id === Number(currentLocationId)
  );
  const canManageLocation = Boolean(currentOrg?.can_manage_organization) || Boolean(selectedLocation?.can_manage);
  const roadmapLocked = Boolean(currentOrg) && currentOrg.modules?.roadmap === false;
  const feedLocked = Boolean(currentOrg) && currentOrg.modules?.feed === false;
  const workspaceItems = [
    { to: "/dashboard", label: "Dashboard", icon: "overview", end: true },
    { to: `${orgBase}/feedback`, label: "Feedback", icon: "reports", disabled: !currentOrg },
    { to: `${orgBase}/roadmap`, label: "Roadmap", icon: "board", disabled: !currentOrg, locked: roadmapLocked },
    { to: `${orgBase}/feed`, label: "Feed", icon: "feed", disabled: !currentOrg, locked: feedLocked },
  ];
  const adminItems = [
    { to: `${orgBase}/settings`, label: "Settings", icon: "settings", disabled: !currentOrg },
    { to: `${orgBase}/locations`, label: "Locations", icon: "location", disabled: !currentOrg },
    { to: `${orgBase}/users`, label: "Users", icon: "users", disabled: !currentOrg },
    { to: `${orgBase}/reviews`, label: "Public reviews", icon: "review", disabled: !currentOrg },
    { to: `${orgBase}/social`, label: "Social accounts", icon: "social", disabled: !currentOrg, locked: feedLocked },
  ];
  const locationManagerItems = [
    { to: `${orgBase}/reviews`, label: "Public reviews", icon: "review", disabled: !currentOrg },
  ];

  function renderNavItems(items) {
    return items.map((item) => item.disabled ? (
      <span className="sidebar-nav-link sidebar-nav-link--disabled" key={item.label}>
        <SidebarIcon name={item.icon} />
        {item.label}
      </span>
    ) : (
      <NavLink
        className={({ isActive }) => `sidebar-nav-link${isActive ? " sidebar-nav-link--active" : ""}${item.locked ? " sidebar-nav-link--locked" : ""}`}
        end={item.end}
        key={item.label}
        onClick={closeOnMobile}
        to={item.to}
      >
        <SidebarIcon name={item.icon} />
        <span>{item.label}</span>
        {item.locked && <span className="sidebar-module-lock" aria-label="Module locked">🔒</span>}
      </NavLink>
    ));
  }

  function renderRailItems(items) {
    return items.map((item) => item.disabled ? (
      <span
        aria-label={item.label}
        className="sidebar-rail-link sidebar-rail-link--disabled"
        key={item.label}
        title={item.label}
      >
        <SidebarIcon name={item.icon} />
      </span>
    ) : (
      <NavLink
        aria-label={`${item.label}${item.locked ? " (locked)" : ""}`}
        className={({ isActive }) => `sidebar-rail-link${isActive ? " sidebar-rail-link--active" : ""}${item.locked ? " sidebar-rail-link--locked" : ""}`}
        end={item.end}
        key={item.label}
        onClick={closeOnMobile}
        title={item.label}
        to={item.to}
      >
        <SidebarIcon name={item.icon} />
        {item.locked && <span className="sidebar-rail-lock" aria-hidden="true">•</span>}
      </NavLink>
    ));
  }

  return (
    <>
      {!isOpen && (
        <aside className="app-sidebar-rail" aria-label="Collapsed sidebar">
          <button
            type="button"
            className="sidebar-panel-toggle"
            aria-label="Open sidebar"
            aria-expanded="false"
            onClick={(event) => {
              event.currentTarget.blur();
              onToggle();
            }}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
          <nav className="sidebar-rail-nav" aria-label="Workspace navigation">
            {renderRailItems(workspaceItems)}
          </nav>
          {canManageLocation && (
            <nav className="sidebar-rail-nav sidebar-rail-nav--admin" aria-label="Administration navigation">
              {renderRailItems(currentOrg?.can_manage_organization ? adminItems : locationManagerItems)}
            </nav>
          )}
        </aside>
      )}
      <aside
        aria-hidden={!isOpen}
        className={`app-sidebar${isOpen ? " app-sidebar--open" : ""}`}
        inert={!isOpen ? true : undefined}
      >
        <div className="sidebar-header">
          <Link className="sidebar-organization-name" to="/dashboard" title={currentOrg?.name || "Organization"}>
            {currentOrg?.name || "Organization"}
          </Link>
          <button
            type="button"
            className="sidebar-panel-toggle"
            aria-label="Collapse sidebar"
            aria-expanded="true"
            onClick={(event) => {
              event.currentTarget.blur();
              onToggle();
            }}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        </div>

        <div className="sidebar-organization">
          <OrganizationSwitcher
            organizations={organizations}
            currentOrgId={currentOrgId}
            isSuperuser={Boolean(user?.is_superuser)}
            onOrgChange={onOrgChange}
            onCreateOrganization={() => {
              onShowCreateOrg();
              closeOnMobile();
            }}
          />
          <LocationSwitcher
            canViewAll={Boolean(currentOrg?.can_view_all_locations)}
            currentLocationId={currentLocationId}
            locations={locations}
            onLocationChange={onLocationChange}
          />
        </div>

        <nav className="sidebar-nav" aria-label="Organization navigation">
          <button
            type="button"
            className="sidebar-section-toggle"
            aria-expanded={isWorkspaceOpen}
            onClick={() => setIsWorkspaceOpen((current) => !current)}
          >
            <span>Workspace</span>
            <span aria-hidden="true">{isWorkspaceOpen ? "−" : "+"}</span>
          </button>
          {isWorkspaceOpen && <div className="sidebar-section-links">{renderNavItems(workspaceItems)}</div>}
        </nav>

        {canManageLocation && (
          <nav
            className="sidebar-nav sidebar-nav--admin"
            aria-label={currentOrg?.can_manage_organization ? "Administration navigation" : "Location management navigation"}
          >
            <button
              type="button"
              className="sidebar-section-toggle"
              aria-expanded={isAdminOpen}
              onClick={() => setIsAdminOpen((current) => !current)}
            >
              <span>{currentOrg?.can_manage_organization ? "Admin" : "Location"}</span>
              <span aria-hidden="true">{isAdminOpen ? "−" : "+"}</span>
            </button>
            {isAdminOpen && (
              <div className="sidebar-section-links">
                {renderNavItems(currentOrg?.can_manage_organization ? adminItems : locationManagerItems)}
              </div>
            )}
          </nav>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-account">
            <span className="sidebar-avatar">{user?.email?.charAt(0).toUpperCase()}</span>
            <div className="sidebar-account-copy">
              <strong>{user?.email}</strong>
              <span>{user?.is_superuser ? "Platform superuser" : accessRoleLabel(currentOrg?.role)}</span>
            </div>
            <button type="button" className="sidebar-logout" onClick={onLogout} aria-label="Log out" title="Log out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 17l5-5-5-5M15 12H3" />
                <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      <button
        type="button"
        className={`sidebar-backdrop${isOpen ? " sidebar-backdrop--visible" : ""}`}
        onClick={onClose}
        aria-label="Close sidebar"
      />
    </>
  );
}

function dashboardPostStatus(status) {
  return {
    draft: "Draft",
    scheduled: "Scheduled",
    publishing: "Publishing",
    published: "Published",
    partial_failure: "Partially published",
    failed: "Failed",
  }[status] || status;
}

function dashboardPostDate(post) {
  const value = post.published_at || post.scheduled_at || post.created_at;
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DashboardModuleLocked({ isSuperuser, moduleName, orgId }) {
  return (
    <div className="dashboard-module-locked">
      <span aria-hidden="true">🔒</span>
      <div>
        <strong>{moduleName} is not enabled for this organization.</strong>
        <p>
          {isSuperuser
            ? "Enable it in Settings to start using this module."
            : "Contact Five* to add this module."}
        </p>
      </div>
      {isSuperuser && (
        <Link to={`/org/${orgId}/settings#modules`}>Enable in Settings →</Link>
      )}
    </div>
  );
}

function Dashboard({ currentOrg, isSuperuser, locationId, organizations, onShowCreateOrg, token }) {
  const [feedbackData, setFeedbackData] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [posts, setPosts] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardErrors, setDashboardErrors] = useState({});

  useEffect(() => {
    if (!token || !currentOrg?.id) return undefined;
    let active = true;
    setDashboardLoading(true);
    setDashboardErrors({});

    const roadmapEnabled = currentOrg.modules?.roadmap !== false;
    const feedEnabled = currentOrg.modules?.feed !== false;
    Promise.allSettled([
      getFeedbackStats(token, currentOrg.id, 30, locationId),
      roadmapEnabled
        ? listOrganizationInitiatives(token, currentOrg.id, locationId)
        : Promise.resolve([]),
      feedEnabled && currentOrg.can_manage_organization
        ? listSocialPosts(token, currentOrg.id, 100)
        : Promise.resolve([]),
    ]).then(([feedbackResult, initiativesResult, postsResult]) => {
      if (!active) return;
      const errors = {};
      if (feedbackResult.status === "fulfilled") {
        setFeedbackData(feedbackResult.value.data || []);
      } else {
        setFeedbackData([]);
        errors.feedback = feedbackResult.reason?.message || "Feedback activity could not be loaded.";
      }
      if (initiativesResult.status === "fulfilled") {
        setInitiatives(initiativesResult.value || []);
      } else {
        setInitiatives([]);
        errors.roadmap = initiativesResult.reason?.message || "Roadmap activity could not be loaded.";
      }
      if (postsResult.status === "fulfilled") {
        setPosts(postsResult.value || []);
      } else {
        setPosts([]);
        errors.feed = postsResult.reason?.message || "Recent posts could not be loaded.";
      }
      setDashboardErrors(errors);
      setDashboardLoading(false);
    });

    return () => {
      active = false;
    };
  }, [
    currentOrg?.can_manage_organization,
    currentOrg?.id,
    currentOrg?.modules?.feed,
    currentOrg?.modules?.roadmap,
    locationId,
    token,
  ]);

  if (!organizations.length) {
    return (
      <div className="dashboard-empty">
        <h2>Welcome to <BrandName /></h2>
        <p>Create your first organization to get started.</p>
        <button type="button" className="btn btn--primary" onClick={onShowCreateOrg}>
          Create organization
        </button>
      </div>
    );
  }

  const feedbackTotal = feedbackData.reduce((sum, point) => sum + point.count, 0);
  const roadmapEnabled = currentOrg?.modules?.roadmap !== false;
  const feedEnabled = currentOrg?.modules?.feed !== false;
  const feedbackActiveDays = feedbackData.filter((point) => point.count > 0).length;
  const totalRoadmapVotes = initiatives.reduce(
    (sum, initiative) => sum + initiative.upvotes + initiative.downvotes,
    0
  );
  const engagedInitiatives = initiatives.filter(
    (initiative) => initiative.upvotes + initiative.downvotes > 0
  );
  const topInitiatives = [...initiatives]
    .sort((left, right) => (
      (right.upvotes + right.downvotes) - (left.upvotes + left.downvotes)
    ))
    .slice(0, 3);
  const publishedPosts = posts.filter((post) => (
    post.status === "published" || post.status === "partial_failure"
  )).length;
  const scheduledPosts = posts.filter((post) => post.status === "scheduled").length;

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <p className="dashboard-kicker">Dashboard</p>
        <h1>{currentOrg?.name}</h1>
        <p>A quick read on whether customers are responding to what you share.</p>
      </div>

      <div className="dashboard-story">
        <section className="dashboard-insight" aria-labelledby="dashboard-feedback-title">
          <div className="dashboard-insight-heading">
            <div>
              <p className="dashboard-step">01 · Feedback</p>
              <h2 id="dashboard-feedback-title">Am I receiving feedback?</h2>
              <p>Customer submissions across the last 30 days.</p>
            </div>
            <Link className="dashboard-section-link" to={`/org/${currentOrg?.id}/feedback`}>
              Review feedback <span aria-hidden="true">→</span>
            </Link>
          </div>

          {dashboardErrors.feedback ? (
            <p className="message message--error">{dashboardErrors.feedback}</p>
          ) : (
            <>
              <div className="dashboard-answer">
                <strong>{dashboardLoading ? "—" : feedbackTotal}</strong>
                <span>submission{feedbackTotal === 1 ? "" : "s"} in the last 30 days</span>
                {!dashboardLoading && feedbackTotal > 0 && (
                  <small>Feedback arrived on {feedbackActiveDays} day{feedbackActiveDays === 1 ? "" : "s"}.</small>
                )}
              </div>
              <SubmissionsChart
                data={feedbackData}
                days={30}
                height={190}
                loading={dashboardLoading}
                total={feedbackTotal}
              />
            </>
          )}
        </section>

        <section className="dashboard-insight" aria-labelledby="dashboard-roadmap-title">
          <div className="dashboard-insight-heading">
            <div>
              <p className="dashboard-step">02 · Roadmap</p>
              <h2 id="dashboard-roadmap-title">Am I getting engagement on my roadmap items?</h2>
              <p>Votes show which published initiatives customers care about.</p>
            </div>
            <Link className="dashboard-section-link" to={`/org/${currentOrg?.id}/roadmap`}>
              View roadmap <span aria-hidden="true">→</span>
            </Link>
          </div>

          {!roadmapEnabled ? (
            <DashboardModuleLocked isSuperuser={isSuperuser} moduleName="Roadmap" orgId={currentOrg.id} />
          ) : dashboardErrors.roadmap ? (
            <p className="message message--error">{dashboardErrors.roadmap}</p>
          ) : dashboardLoading ? (
            <p className="dashboard-loading-state">Loading roadmap activity…</p>
          ) : (
            <>
              <div className="dashboard-metric-grid">
                <div className="dashboard-metric">
                  <strong>{totalRoadmapVotes}</strong>
                  <span>Total votes</span>
                </div>
                <div className="dashboard-metric">
                  <strong>{engagedInitiatives.length}</strong>
                  <span>Items with engagement</span>
                </div>
                <div className="dashboard-metric">
                  <strong>{initiatives.length}</strong>
                  <span>Published items</span>
                </div>
              </div>
              {topInitiatives.length ? (
                <div className="dashboard-ranked-list">
                  {topInitiatives.map((initiative) => (
                    <div className="dashboard-ranked-item" key={initiative.id}>
                      <div>
                        <strong>{initiative.title}</strong>
                        <small>{initiative.location_name}</small>
                      </div>
                      <span>{initiative.upvotes} up · {initiative.downvotes} down</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dashboard-empty-state">No roadmap items have been published yet.</p>
              )}
            </>
          )}
        </section>

        <section className="dashboard-insight" aria-labelledby="dashboard-feed-title">
          <div className="dashboard-insight-heading">
            <div>
              <p className="dashboard-step">03 · Feed</p>
              <h2 id="dashboard-feed-title">Are my recent feed posts going out?</h2>
              <p>Publishing activity recorded inside Five*.</p>
            </div>
            <Link className="dashboard-section-link" to={`/org/${currentOrg?.id}/feed`}>
              Open feed <span aria-hidden="true">→</span>
            </Link>
          </div>

          {!feedEnabled ? (
            <DashboardModuleLocked isSuperuser={isSuperuser} moduleName="Feed" orgId={currentOrg.id} />
          ) : !currentOrg?.can_manage_organization ? (
            <p className="dashboard-empty-state">Recent publishing activity is available to organization admins.</p>
          ) : dashboardErrors.feed ? (
            <p className="message message--error">{dashboardErrors.feed}</p>
          ) : dashboardLoading ? (
            <p className="dashboard-loading-state">Loading recent posts…</p>
          ) : (
            <>
              <div className="dashboard-metric-grid">
                <div className="dashboard-metric">
                  <strong>{posts.length}</strong>
                  <span>Posts created</span>
                </div>
                <div className="dashboard-metric">
                  <strong>{publishedPosts}</strong>
                  <span>Published</span>
                </div>
                <div className="dashboard-metric">
                  <strong>{scheduledPosts}</strong>
                  <span>Scheduled</span>
                </div>
              </div>
              {posts.length ? (
                <div className="dashboard-ranked-list">
                  {posts.slice(0, 5).map((post) => (
                    <div className="dashboard-ranked-item dashboard-post-item" key={post.id}>
                      <div>
                        <strong>{post.master_caption}</strong>
                        <small>{dashboardPostDate(post)}</small>
                      </div>
                      <span>{dashboardPostStatus(post.status)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dashboard-empty-state">No feed posts have been created in Five* yet.</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function VotingBoardAdminPage({
  token,
  currentOrg,
  currentLocation,
  locationId,
  locations,
  canManage,
}) {
  if (!currentOrg) return <div className="owner-feature-page"><p>Loading organization…</p></div>;
  return (
    <div className="owner-feature-page">
      <InitiativesManager
        token={token}
        orgId={currentOrg.id}
        isAdmin={canManage}
        locationId={locationId}
        locations={locations}
        publicBoardUrl={currentLocation ? `/roadmap/${currentLocation.feedback_token}` : null}
      />
    </div>
  );
}

function FeedbackReportsPage({ token, currentOrg, currentLocation, locationId, canManage }) {
  if (!currentOrg) return <div className="owner-feature-page"><p>Loading organization…</p></div>;
  return (
    <div className="owner-feature-page">
      <DigestManager
        key={`${currentOrg.id}-${locationId || "all"}`}
        token={token}
        orgId={currentOrg.id}
        locationId={locationId}
        isAdmin={canManage}
        timezone={currentLocation?.timezone}
      />
    </div>
  );
}
