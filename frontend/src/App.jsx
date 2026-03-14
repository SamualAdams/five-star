import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { acceptInvite, listOrganizations, login, me, signup } from "./api";
import CreateOrgModal from "./components/CreateOrgModal";
import DigestManager from "./components/DigestManager";
import DigestsPage from "./components/DigestsPage";
import FeedbackPage from "./components/FeedbackPage";
import InviteAcceptPage from "./components/InviteAcceptPage";
import OrganizationSwitcher from "./components/OrganizationSwitcher";
import OrgSettingsPage from "./components/OrgSettingsPage";
import SearchPage from "./components/SearchPage";
import TopbarSearch from "./components/TopbarSearch";

const TOKEN_KEY = "five-star-token";
const CURRENT_ORG_KEY = "five-star-current-org";
const LOGO_SRC = `${import.meta.env.BASE_URL}brand/five-star-logo.svg`;

export default function App() {
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
        setToken("");
        setUser(null);
      }
    }
    loadUser();
  }, [token]);

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
    <div className="layout">
      <header className="topbar">
        <img className="topbar-logo" src={LOGO_SRC} alt="five*" />

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, justifyContent: "flex-end" }}>
          <TopbarSearch />

          <div className="menu-wrap">
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
            {isAuthenticated ? (
              <>
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
                      setShowCreateOrg(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    + New Organization
                  </button>
                  <button type="button" className="menu-item" onClick={logout}>
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <div className="menu-section">
                <MenuLink to="/" label="Sign up / Log in" setIsMenuOpen={setIsMenuOpen} />
              </div>
            )}
            </div>
          </div>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage
                token={token}
                setToken={setToken}
                setUser={setUser}
                loadOrganizations={loadOrganizations}
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
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/org/:id/settings"
          element={
            isAuthenticated ? (
              <OrgSettingsPage token={token} user={user} />
            ) : (
              <Navigate to="/" replace />
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
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/feedback/:feedbackToken" element={<FeedbackPage />} />
      </Routes>

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

function AuthPage({ token, setToken, setUser, loadOrganizations }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const pendingInvite = searchParams.get("invite");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const action = mode === "signup" ? signup : login;
      const response = await action(email, password);
      const accessToken = response.token.access_token;
      localStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
      setUser(response.user);
      setPassword("");

      if (pendingInvite) {
        try {
          await acceptInvite(accessToken, pendingInvite);
        } catch {
          // invite may be expired or already used, continue to dashboard
        }
        await loadOrganizations(accessToken);
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      setMessage(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-card-head">five*</div>
      <div className="auth-card-body">
        <h1 className="auth-title">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-subtitle">
          {pendingInvite
            ? "Sign up or log in to accept your invite."
            : mode === "signup"
              ? "Start collecting feedback in minutes."
              : "Log in to your account."}
        </p>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${mode === "signup" ? "tab--active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
          <button
            type="button"
            className={`tab ${mode === "login" ? "tab--active" : ""}`}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            className="field-input"
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="field-label" htmlFor="password">
            Password (8+ chars)
          </label>
          <input
            className="field-input"
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          <button className="btn btn--primary" type="submit" disabled={isLoading}>
            {isLoading ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
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

      {isAdmin && currentOrg && (
        <DigestManager token={token} orgId={currentOrg.id} isAdmin={true} />
      )}
    </div>
  );
}
