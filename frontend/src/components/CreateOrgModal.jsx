import { useState, useEffect } from "react";
import { createOrganization } from "../api";

export default function CreateOrgModal({ token, onCreated, onClose }) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && onClose) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const org = await createOrganization(token, name);
      onCreated(org);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button
            type="button"
            className="modal-close-x"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
        <h2 className="modal-title">Create an Organization</h2>
        <p className="modal-subtitle">Name your organization to get started.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="org-name">
            Organization name
          </label>
          <input
            className="field-input"
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            minLength={1}
            maxLength={255}
            required
            autoFocus
          />

          <button className="btn btn--primary" type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create organization"}
          </button>
        </form>

        {error && <p className="message message--error">{error}</p>}

        {onClose && (
          <button type="button" className="btn btn--ghost modal-close" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
