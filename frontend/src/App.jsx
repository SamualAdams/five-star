import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { listOrganizations, me } from "./api";
import AuthPage from "./components/AuthPage";
import CreateOrgModal from "./components/CreateOrgModal";
import DigestManager from "./components/DigestManager";
import DigestsPage from "./components/DigestsPage";
import FeedbackPage from "./components/FeedbackPage";
import InviteAcceptPage from "./components/InviteAcceptPage";
import MarketingPage from "./components/MarketingPage";
import OrganizationSwitcher from "./components/OrganizationSwitcher";
import OrgSettingsPage from "./components/OrgSettingsPage";
import SearchPage from "./components/SearchPage";
import TopbarSearch from "./components/TopbarSearch";

const TOKEN_KEY = "five-star-token";
const CURRENT_ORG_KEY = "five-star-current-org";
const LOGO_SRC = `${import.meta.env.BASE_URL}brand/five-star-logo.svg`;

export default function App() {
  const location = useLocation();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [currentOrgId, setCurrentOrgId] = useState(() => {
    const saved = localStorage.getItem(CURRENT_ORG_KEY);
    return saved ? Number(saved) : null;
  });
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);
  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === currentOrgId) || organizations[0] || null,
    [organizations, currentOrgId]
  );
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
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(CURRENT_ORG_KEY);
        setToken("");
        setUser(null);
        setOrganizations([]);
        setCurrentOrgId(null);
      }
    }
    loadUser();
  }, [token, loadOrganizations]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, isAuthenticated]);

  function handleOrgChange(orgId) {
    setCurrentOrgId(orgId);
    localStorage.setItem(CURRENT_ORG_KEY, String(orgId));
  }

  function handleOrgCreated(org) {
    setOrganizations((prev) => [...prev, org]);
    setCurrentOrgId(org.id);
    localStorage.setItem(CURRENT_ORG_KEY, String(org.id));
    setShowCreateOrg(false);
  }

  function handleAuthenticated(accessToken, currentUser) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setUser(currentUser);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CURRENT_ORG_KEY);
    setToken("");
    setUser(null);
    setOrganizations([]);
    setCurrentOrgId(null);
    setIsMenuOpen(false);
  }

  return (
    <div className={`layout ${isAuthenticated && isAppRoute ? "layout--app" : "layout--public"}`}>
      {isAuthenticated && isAppRoute ? (
        <AppHeader
          currentOrg={currentOrg}
          isMenuOpen={isMenuOpen}
          onLogout={logout}
          onShowCreateOrg={() => setShowCreateOrg(true)}
          setIsMenuOpen={setIsMenuOpen}
          user={user}
        />
      ) : (
        <PublicHeader isAuthenticated={isAuthenticated} />
      )}

      <main className={`app-main ${isAuthenticated && isAppRoute ? "app-main--app" : "app-main--public"}`}>
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
                  token={token}
                  currentOrg={currentOrg}
                  currentOrgId={currentOrg?.id}
                  organizations={organizations}
                  onOrgChange={handleOrgChange}
                  onShowCreateOrg={() => setShowCreateOrg(true)}
                />
              ) : (
                <Navigate to="/auth?mode=login" replace />
              )
            }
          />
          <Route
            path="/org/:id/settings"
            element={
              isAuthenticated ? (
                <OrgSettingsPage token={token} user={user} />
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
          <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
        </Routes>
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
        <span className="brand-tag">Built in Baton Rouge for Baton Rouge businesses</span>
      </Link>

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
              Get started free
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
                  Get started free
                </Link>
                <Link className="menu-item" to="/auth?mode=login" onClick={() => setIsMenuOpen(false)}>
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function AppHeader({ currentOrg, isMenuOpen, onLogout, onShowCreateOrg, setIsMenuOpen, user }) {
  return (
    <header className="topbar topbar--app">
      <img className="topbar-logo" src={LOGO_SRC} alt="five*" />

      <div className="app-header-actions">
        <TopbarSearch />

        <div className="menu-wrap">
          <button
            type="button"
            className="hamburger"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>

          <div className={`menu-panel ${isMenuOpen ? "menu-panel--open" : ""}`}>
            <div className="menu-section">
              <p className="menu-kicker">Navigation</p>
              <MenuLink to="/dashboard" label="Dashboard" setIsMenuOpen={setIsMenuOpen} />
              {currentOrg && (
                <MenuLink
                  to={`/org/${currentOrg.id}/settings`}
                  label="Org Settings"
                  setIsMenuOpen={setIsMenuOpen}
                />
              )}
            </div>
            <div className="menu-divider" />
            <div className="menu-section">
              <p className="menu-kicker">Account</p>
              <p className="menu-email">{user.email}</p>
              <div style={{ marginTop: "0.8rem" }} />
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onShowCreateOrg();
                  setIsMenuOpen(false);
                }}
              >
                + New Organization
              </button>
              <button type="button" className="menu-item" onClick={onLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuLink({ to, label, setIsMenuOpen }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="menu-item"
      onClick={() => {
        setIsMenuOpen(false);
        navigate(to);
      }}
    >
      {label}
    </button>
  );
}

function Dashboard({ token, currentOrg, currentOrgId, organizations, onOrgChange, onShowCreateOrg }) {
  const navigate = useNavigate();
  const isAdmin = currentOrg?.role === "admin";

  if (!organizations.length) {
    return (
      <div className="dashboard-empty">
        <h2>Welcome to five*</h2>
        <p>Create your first organization to get started.</p>
        <button type="button" className="btn btn--primary" onClick={onShowCreateOrg}>
          Create organization
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">{currentOrg?.name}</h2>
        <div className="dashboard-actions">
          <OrganizationSwitcher
            organizations={organizations}
            currentOrgId={currentOrgId}
            onOrgChange={onOrgChange}
          />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => navigate(`/org/${currentOrg?.id}/settings`)}
          >
            Org Settings
          </button>
        </div>
      </div>

      {isAdmin && currentOrg && <DigestManager token={token} orgId={currentOrg.id} isAdmin={true} />}
    </div>
  );
}
