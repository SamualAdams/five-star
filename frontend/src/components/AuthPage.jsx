import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { acceptInvite, login, signup } from "../api";

export default function AuthPage({ loadOrganizations, onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = searchParams.get("mode") === "login" ? "login" : "signup";
  const pendingInvite = searchParams.get("invite");

  function handleModeChange(nextMode) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", nextMode);
    setSearchParams(nextParams, { replace: true });
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const action = mode === "signup" ? signup : login;
      const response = await action(email, password);
      const accessToken = response.token.access_token;
      onAuthenticated(accessToken, response.user);
      setPassword("");

      if (pendingInvite) {
        try {
          await acceptInvite(accessToken, pendingInvite);
        } catch {
          // Invite may be expired or already used; continue to the dashboard.
        }
      }

      await loadOrganizations(accessToken);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setMessage(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-intro">
        <div>
          <h1 className="auth-intro-title">
            {mode === "signup" ? "Create your free account" : "Welcome back"}
          </h1>
          <p className="auth-intro-copy">
            Collect honest customer feedback, review clear summaries, and keep making your
            business better without adding another paid platform to your stack.
          </p>
        </div>

        <div className="auth-highlight-list">
          <div className="auth-highlight">
            <h2>Free to use</h2>
            <p>Made to support local businesses, not sell into them.</p>
          </div>
          <div className="auth-highlight">
            <h2>Simple setup</h2>
            <p>Create your organization, share a feedback link, and start learning quickly.</p>
          </div>
          <div className="auth-highlight">
            <h2>Actionable insight</h2>
            <p>Digest summaries help you turn comments into practical next steps.</p>
          </div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card-head">
          <img className="auth-brand-logo" src={`${import.meta.env.BASE_URL}brand/five-star-logo.svg`} alt="five*" />
          <Link className="auth-home-link" to="/">
            Back to home
          </Link>
        </div>
        <div className="auth-card-body">
          <h2 className="auth-title">{mode === "signup" ? "Create your account" : "Log in"}</h2>
          <p className="auth-subtitle">
            {pendingInvite
              ? "Sign up or log in to accept your invite."
              : mode === "signup"
                ? "Start improving customer experience — it's free."
                : "Pick up where you left off."}
          </p>

          <div className="tabs">
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
      </section>
    </div>
  );
}
