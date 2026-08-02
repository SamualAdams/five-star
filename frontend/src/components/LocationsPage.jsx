import { useState } from "react";
import { createLocation, deleteLocation, getLocationDeletionImpact, updateLocation } from "../api";
import PortalPageHeader from "./PortalPageHeader";

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

function DeleteLocationDialog({ impact, isDeleting, location, locations, onCancel, onConfirm, submitError }) {
  const otherLocations = locations.filter((item) => item.id !== location.id);
  const [destination, setDestination] = useState("organization");
  const [deleteReports, setDeleteReports] = useState(false);
  const movableCount = impact.feedback + impact.roadmap_items + impact.feed_posts + impact.reports;
  const destinationIsOrganization = destination === "organization";
  const reportsNeedDecision = destinationIsOrganization && impact.reports > 0;
  const inventory = [
    ["Feedback submissions", impact.feedback],
    ["Roadmap items", impact.roadmap_items],
    ["Feed posts", impact.feed_posts],
    ["Feedback reports", impact.reports],
  ].filter(([, count]) => count > 0);

  function submit() {
    if (!movableCount) {
      onConfirm(null);
      return;
    }
    onConfirm({
      destination: destinationIsOrganization ? "organization" : "location",
      destination_location_id: destinationIsOrganization ? null : Number(destination),
      delete_reports: reportsNeedDecision && deleteReports,
    });
  }

  return (
    <div className="modal-backdrop" onClick={isDeleting ? undefined : onCancel}>
      <div className="modal-card location-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-location-title" onClick={(event) => event.stopPropagation()}>
        <h2 className="modal-title" id="delete-location-title">Delete “{location.name}”?</h2>
        <p className="modal-subtitle">
          {movableCount
            ? "Choose where this location’s content should live after it is deleted."
            : "This location has no feedback, roadmap items, posts, or reports."}
        </p>

        {inventory.length > 0 && (
          <div className="location-delete-inventory" aria-label="Location content">
            {inventory.map(([label, count]) => (
              <div key={label}>
                <strong>{count}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}

        {movableCount > 0 && (
          <label className="location-delete-destination" htmlFor="location-delete-destination">
            <span className="field-label">Move content to</span>
            <select
              className="field-select"
              id="location-delete-destination"
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setDeleteReports(false);
              }}
            >
              <option value="organization">Organization-wide</option>
              {otherLocations.map((item) => (
                <option value={item.id} key={item.id}>{item.name}</option>
              ))}
            </select>
            <small>
              {destinationIsOrganization
                ? "Feedback, roadmap items, and feed posts will no longer have a location tag."
                : "All listed content, including reports, will move to the selected location."}
            </small>
          </label>
        )}

        {reportsNeedDecision && (
          <label className="location-delete-report-warning">
            <input type="checkbox" checked={deleteReports} onChange={(event) => setDeleteReports(event.target.checked)} />
            <span>
              Permanently delete {impact.reports} feedback report{impact.reports === 1 ? "" : "s"}.
              Reports cannot be organization-wide.
            </span>
          </label>
        )}

        {(impact.social_connections > 0 || impact.team_assignments > 0 || impact.pending_invites > 0) && (
          <div className="location-delete-side-effects">
            {impact.social_connections > 0 && <p>{impact.social_connections} location-specific social connection{impact.social_connections === 1 ? "" : "s"} will be disconnected.</p>}
            {impact.team_assignments > 0 && <p>{impact.team_assignments} team assignment{impact.team_assignments === 1 ? "" : "s"} will be removed.</p>}
            {impact.pending_invites > 0 && <p>{impact.pending_invites} pending invite{impact.pending_invites === 1 ? "" : "s"} will be cancelled.</p>}
          </div>
        )}

        {submitError && <p className="message message--error">{submitError}</p>}

        <div className="location-delete-actions">
          <button className="btn btn--ghost" type="button" onClick={onCancel} disabled={isDeleting}>Cancel</button>
          <button className="btn btn--danger" type="button" onClick={submit} disabled={isDeleting || (reportsNeedDecision && !deleteReports)}>
            {isDeleting ? "Deleting…" : movableCount ? "Move content and delete" : "Delete location"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LocationsPage({
  locations,
  onLocationsChanged,
  orgId,
  roadmapEnabled = true,
  feedEnabled = true,
  organizationToken,
  token,
}) {
  const landingEnabled = roadmapEnabled || feedEnabled;
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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
    setError("");
    try {
      const impact = await getLocationDeletionImpact(token, orgId, location.id);
      setDeleteDialog({ location, impact });
      setDeleteError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete(payload) {
    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteLocation(token, orgId, deleteDialog.location.id, payload);
      setDeleteDialog(null);
      await onLocationsChanged();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="locations-page">
      <PortalPageHeader
        description="Manage location-specific feedback links, content tags, and team access."
        eyebrow="Admin"
        title="Locations"
      />

      {error && <p className="message message--error">{error}</p>}

      <section className="portal-card location-create-card">
        <div className="portal-card-heading">
          <div>
            <h2>Add a location</h2>
            <p className="portal-card-description">
              Each location gets its own direct feedback link. The organization landing page is shared.
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
              {landingEnabled ? (
                <PublicLink
                  label="Landing page"
                  url={`${window.location.origin}/five-star/${organizationToken}`}
                />
              ) : (
                <div className="location-public-link location-public-link--locked">
                  <span>Landing page</span>
                  <strong>🔒 Enable Feed or Roadmap to publish a landing page</strong>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      {deleteDialog && (
        <DeleteLocationDialog
          key={deleteDialog.location.id}
          impact={deleteDialog.impact}
          isDeleting={isDeleting}
          location={deleteDialog.location}
          locations={locations}
          onCancel={() => !isDeleting && setDeleteDialog(null)}
          onConfirm={confirmDelete}
          submitError={deleteError}
        />
      )}
    </div>
  );
}
