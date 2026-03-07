import { useEffect, useMemo, useRef, useState } from "react";
import { login, me, signup } from "./api";

const TOKEN_KEY = "five-star-token";
const LOGO_SRC = `${import.meta.env.BASE_URL}brand/five-star-logo.svg`;

export default function App() {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const currentUser = await me(token);
        setUser(currentUser);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      }
    }

    loadUser();
  }, [token]);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!isNavOpen) {
        return;
      }

      const target = event.target;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) {
        return;
      }

      setIsNavOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsNavOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNavOpen]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const action = mode === "signup" ? signup : login;
      const response = await action(email, password);
      localStorage.setItem(TOKEN_KEY, response.token.access_token);
      setToken(response.token.access_token);
      setUser(response.user);
      setMessage(mode === "signup" ? "Account created and signed in." : "Signed in.");
      setPassword("");
      setIsNavOpen(false);
    } catch (error) {
      setMessage(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setMessage("Signed out.");
    setIsNavOpen(false);
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);
    setMessage("");
    setIsNavOpen(false);
  }

  function jumpToAuthCard() {
    const authCard = document.getElementById("auth-card");
    if (authCard) {
      authCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsNavOpen(false);
  }

  return (
    <main className="layout">
      <header className="topbar">
        <img className="topbar-logo" src={LOGO_SRC} alt="five*" />
        <div className="menu-wrap">
          <button
            ref={menuButtonRef}
            type="button"
            className="hamburger"
            aria-label="Toggle navigation menu"
            aria-haspopup="menu"
            aria-expanded={isNavOpen}
            aria-controls="topbar-menu"
            onClick={() => setIsNavOpen((current) => !current)}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>

          <div
            ref={menuRef}
            id="topbar-menu"
            className={`menu-panel ${isNavOpen ? "menu-panel--open" : ""}`}
            role="menu"
            aria-label="Account menu"
          >
            <div className="menu-section">
              <button type="button" className="menu-item" onClick={jumpToAuthCard}>
                Go to auth form
              </button>
            </div>

            <div className="menu-divider" />

            <div className="menu-section">
              {isAuthenticated ? (
                <>
                  <p className="menu-kicker">Signed in as</p>
                  <p className="menu-email">{user.email}</p>
                  <button type="button" className="menu-item" onClick={logout}>
                    Log out
                  </button>
                </>
              ) : (
                <p className="menu-note">
                  Create your account or sign in from the card below.
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <section id="auth-card" className="auth-card" aria-label="Authentication">
        <div className="auth-card-head">Log in or sign up</div>

        <div className="auth-card-body">
          <h1 className="auth-title">
            {isAuthenticated ? "You're signed in" : "Welcome to five*"}
          </h1>
          <p className="auth-subtitle">
            {isAuthenticated
              ? "Your account session is active."
              : "Use your email and password to create your account or sign in."}
          </p>

          {isAuthenticated ? (
            <div className="authed">
              <p>
                Logged in as <strong>{user.email}</strong>
              </p>
              <button type="button" className="btn btn--primary" onClick={logout}>
                Log out
              </button>
            </div>
          ) : (
            <>
              <div className="tabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  className={`tab ${mode === "signup" ? "tab--active" : ""}`}
                  onClick={() => handleModeChange("signup")}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  className={`tab ${mode === "login" ? "tab--active" : ""}`}
                  onClick={() => handleModeChange("login")}
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
                  onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />

                <button className="btn btn--primary" type="submit" disabled={isLoading}>
                  {isLoading ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
                </button>
              </form>
            </>
          )}

          {message && <p className="message">{message}</p>}
        </div>
      </section>
    </main>
  );
}
