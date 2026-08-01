import { useState } from "react";
import { createLocation, deleteLocation, updateLocation } from "../api";

function PublicLink({ label, url }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="location-public-link">
      <span>{label}</span>
      <input type="text" readOnly value={url} />
      <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function LocationsPage({ locations, onLocationsChanged, orgId, roadmapEnabled = true, token }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await createLocation(token, orgId, { name, address: address || null, timezone });
      setName("");
      setAddress("");
      await onLocationsChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRename(location) {
    const nextName = window.prompt("Location name", location.name);
    if (!nextName?.trim() || nextName.trim() === location.name) return;
    setError("");
    try {
      await updateLocation(token, orgId, location.id, { name: nextName.trim() });
      await onLocationsChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(location) {
    if (!window.confirm(`Delete "${location.name}"?`)) return;
    setError("");
    try {
      await deleteLocation(token, orgId, location.id);
      await onLocationsChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="locations-page">
      <header className="portal-page-heading">
        <p className="dashboard-kicker">Admin</p>
        <h1>Locations</h1>
        <p>Partition feedback, roadmap items, public links, and team access by business location.</p>
      </header>

      {error && <p className="message message--error">{error}</p>}

      <section className="portal-card location-create-card">
        <div className="portal-card-heading">
          <div>
            <h2>Add a location</h2>
            <p className="portal-card-description">
              Each location gets its own feedback link{roadmapEnabled ? " and roadmap link" : ""}.
            </p>
          </div>
        </div>
        <form className="location-create-form" onSubmit={handleCreate}>
          <div className="location-create-fields">
            <label className="location-create-field" htmlFor="location-name">
              <span className="field-label">Location name</span>
              <input
                className="field-input"
                id="location-name"
                placeholder="Downtown Baton Rouge"
                required
                maxLength="255"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="location-create-field" htmlFor="location-address">
              <span className="field-label">Address <span className="optional-label">Optional</span></span>
              <input
                className="field-input"
                id="location-address"
                placeholder="123 Main Street"
                maxLength="500"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </label>
            <label className="location-create-field" htmlFor="location-timezone">
              <span className="field-label">Timezone</span>
              <select
                className="field-select"
                id="location-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                <option value="America/Chicago">Central time</option>
                <option value="America/New_York">Eastern time</option>
                <option value="America/Denver">Mountain time</option>
                <option value="America/Los_Angeles">Pacific time</option>
              </select>
            </label>
          </div>
          <div className="location-create-actions">
            <button type="submit" className="btn btn--primary" disabled={isSaving}>
              {isSaving ? "Adding…" : "Add location"}
            </button>
          </div>
        </form>
      </section>

      <section className="location-card-list" aria-label="Organization locations">
        {locations.map((location) => (
          <article className="portal-card location-card" key={location.id}>
            <div className="location-card-heading">
              <div>
                <div className="location-title-row">
                  <h2>{location.name}</h2>
                  {location.is_default && <span className="status-pill status-pill--soon">Default</span>}
                </div>
                <p>{location.address || "No address added"} · {location.timezone}</p>
              </div>
              <div className="location-card-actions">
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => handleRename(location)}>Rename</button>
                {!location.is_default && (
                  <button className="btn btn--ghost btn--sm initiative-delete-button" type="button" onClick={() => handleDelete(location)}>Delete</button>
                )}
              </div>
            </div>
            <div className="location-public-links">
              <PublicLink
                label="Feedback"
                url={`${window.location.origin}/feedback/${location.feedback_token}`}
              />
              {roadmapEnabled ? (
                <PublicLink
                  label="Roadmap"
                  url={`${window.location.origin}/roadmap/${location.feedback_token}`}
                />
              ) : (
                <div className="location-public-link location-public-link--locked">
                  <span>Roadmap</span>
                  <strong>🔒 Roadmap module not enabled</strong>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
