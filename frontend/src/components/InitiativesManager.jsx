import { useEffect, useState } from "react";
import {
  createOrganizationInitiative,
  deleteOrganizationInitiative,
  listOrganizationInitiatives,
  updateOrganizationInitiative,
} from "../api";

const STATUSES = [
  { value: "gathering_feedback", label: "Gathering feedback" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "shipped", label: "Shipped" },
];

function statusLabel(status) {
  return STATUSES.find((option) => option.value === status)?.label || status;
}

function InitiativeEditor({ initiative, onCancel, onSave, saving }) {
  const [title, setTitle] = useState(initiative.title);
  const [description, setDescription] = useState(initiative.description);
  const [status, setStatus] = useState(initiative.status);

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ title, description, status });
  }

  return (
    <form className="initiative-edit-form" onSubmit={handleSubmit}>
      <label className="field-label" htmlFor={`initiative-title-${initiative.id}`}>Title</label>
      <input
        className="field-input"
        id={`initiative-title-${initiative.id}`}
        value={title}
        maxLength={160}
        required
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="field-label" htmlFor={`initiative-description-${initiative.id}`}>Details</label>
      <textarea
        className="field-textarea"
        id={`initiative-description-${initiative.id}`}
        value={description}
        rows="4"
        maxLength={5000}
        required
        onChange={(event) => setDescription(event.target.value)}
      />
      <label className="field-label" htmlFor={`initiative-status-${initiative.id}`}>Status</label>
      <select
        className="field-select"
        id={`initiative-status-${initiative.id}`}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <div className="initiative-edit-actions">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button className="btn btn--ghost btn--sm" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

export default function InitiativesManager({
  token,
  orgId,
  isAdmin,
  locationId,
  locations = [],
  publicBoardUrl,
  showHeading = true,
}) {
  const [initiatives, setInitiatives] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("gathering_feedback");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadInitiatives() {
      setIsLoading(true);
      setError("");
      try {
        const result = await listOrganizationInitiatives(token, orgId, locationId);
        if (active) setInitiatives(result);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadInitiatives();
    return () => { active = false; };
  }, [locationId, orgId, token]);

  useEffect(() => {
    setTitle("");
    setDescription("");
    setStatus("gathering_feedback");
    setEditingId(null);
  }, [locationId, orgId]);

  async function handleCreate(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const created = await createOrganizationInitiative(token, orgId, {
        title,
        description,
        status,
        location_id: locationId,
      });
      setInitiatives((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setStatus("gathering_feedback");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(initiativeId, update) {
    setIsSaving(true);
    setError("");
    try {
      const saved = await updateOrganizationInitiative(token, orgId, initiativeId, update);
      setInitiatives((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(initiative) {
    setIsSaving(true);
    setError("");
    try {
      await deleteOrganizationInitiative(token, orgId, initiative.id);
      setInitiatives((current) => current.filter((item) => item.id !== initiative.id));
      setDeletingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="initiatives-manager">
      {showHeading && (
        <div className="initiatives-manager-heading">
          <div>
            <p className="dashboard-kicker">Public roadmap</p>
            <h3>What you&apos;re working on</h3>
            <p>Share initiatives on your public page and let visitors show what they care about most.</p>
          </div>
          {publicBoardUrl && (
            <LinkButton href={publicBoardUrl} />
          )}
        </div>
      )}

      {error && <p className="message message--error">{error}</p>}

      {isAdmin && (
        <form className="initiative-create-form" onSubmit={handleCreate}>
          <div className="initiative-form-heading">
            <strong>Add an initiative</strong>
            <span>
              It will appear immediately on your public roadmap as {locationId
                ? locations.find((location) => location.id === locationId)?.name || "this location"
                : "organization-wide"} content.
            </span>
          </div>
          <label className="field-label" htmlFor="initiative-title">Title</label>
          <input
            className="field-input"
            id="initiative-title"
            placeholder="e.g. Online appointment booking"
            value={title}
            maxLength={160}
            required
            onChange={(event) => setTitle(event.target.value)}
          />
          <label className="field-label" htmlFor="initiative-description">What are you working on?</label>
          <textarea
            className="field-textarea"
            id="initiative-description"
            placeholder="Share the context, goal, or customer benefit."
            rows="4"
            value={description}
            maxLength={5000}
            required
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="initiative-create-footer">
            <div className="initiative-create-selects">
              <label className="initiative-status-select" htmlFor="initiative-status">
                <span>Status</span>
                <select id="initiative-status" className="field-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                  {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <button className="btn btn--primary" type="submit" disabled={isSaving}>{isSaving ? "Posting…" : "Post to roadmap"}</button>
          </div>
        </form>
      )}

      <div className="initiative-admin-list">
        <div className="initiative-admin-list-heading">
          <h4>{isAdmin ? "Published initiatives" : "Initiatives"}</h4>
          {!isLoading && <span>{initiatives.length}</span>}
        </div>
        {isLoading ? (
          <p className="initiative-list-state">Loading initiatives…</p>
        ) : initiatives.length ? (
          initiatives.map((initiative) => (
            <article className="initiative-admin-card" key={initiative.id}>
              {editingId === initiative.id ? (
                <InitiativeEditor
                  initiative={initiative}
                  saving={isSaving}
                  onCancel={() => setEditingId(null)}
                  onSave={(update) => handleUpdate(initiative.id, update)}
                />
              ) : (
                <>
                  <div className="initiative-admin-card-copy">
                    <div className="initiative-admin-meta">
                      {!locationId && (
                        <span className="initiative-location-badge">
                          {initiative.location_name || "Organization-wide"}
                        </span>
                      )}
                      <span className={`initiative-status initiative-status--${initiative.status}`}>{statusLabel(initiative.status)}</span>
                      <span>{initiative.score > 0 ? "+" : ""}{initiative.score} score</span>
                      <span>{initiative.upvotes} up · {initiative.downvotes} down</span>
                    </div>
                    <h5>{initiative.title}</h5>
                    <p>{initiative.description}</p>
                  </div>
                  {isAdmin && (
                    <div className="initiative-admin-actions">
                      {deletingId === initiative.id ? (
                        <>
                          <span>Delete "{initiative.title}"?</span>
                          <button className="btn btn--danger btn--sm" type="button" disabled={isSaving} onClick={() => handleDelete(initiative)}>Confirm</button>
                          <button className="btn btn--ghost btn--sm" type="button" disabled={isSaving} onClick={() => setDeletingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn--ghost btn--sm" type="button" disabled={isSaving} onClick={() => setEditingId(initiative.id)}>Edit</button>
                          <button className="btn btn--ghost btn--sm initiative-delete-button" type="button" disabled={isSaving} onClick={() => setDeletingId(initiative.id)}>Delete</button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </article>
          ))
        ) : (
          <p className="initiative-list-state">{isAdmin ? "Post your first initiative to get the roadmap started." : "No initiatives have been posted yet."}</p>
        )}
      </div>
    </section>
  );
}

function LinkButton({ href }) {
  return (
    <a className="btn btn--ghost btn--sm initiatives-public-link" href={href} target="_blank" rel="noreferrer">
      <span>Open public page</span>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 13 13 7M8 7h5v5" />
      </svg>
    </a>
  );
}
