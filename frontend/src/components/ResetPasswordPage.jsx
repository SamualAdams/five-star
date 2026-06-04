import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [succeeded, setSucceeded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("Passwords don't match.");
      return;
    }
    setMessage("");
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setSucceeded(true);
      setTimeout(() => navigate("/auth?mode=login", { replace: true }), 2500);
    } catch (err) {
      setMessage(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <div className="auth-card-body">
            <h2 className="auth-title">Invalid link</h2>
            <p className="auth-subtitle">This reset link is missing or malformed.</p>
            <Link className="btn btn--primary" to="/auth?mode=login">Back to log in</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-head">
          <img className="auth-brand-logo" src={`${import.meta.env.BASE_URL}brand/five-star-logo.svg`} alt="five*" />
          <Link className="auth-home-link" to="/">Back to home</Link>
        </div>
        <div className="auth-card-body">
          <h2 className="auth-title">Choose a new password</h2>
          <p className="auth-subtitle">Must be at least 8 characters.</p>

          {succeeded ? (
            <p className="message message--success">Password updated. Redirecting to log in…</p>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="password">New password (8+ chars)</label>
              <input
                className="field-input"
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <label className="field-label" htmlFor="confirm">Confirm new password</label>
              <input
                className="field-input"
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
              <button className="btn btn--primary" type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Set new password"}
              </button>
            </form>
          )}

          {message && <p className="message message--error">{message}</p>}
        </div>
      </section>
    </div>
  );
}
