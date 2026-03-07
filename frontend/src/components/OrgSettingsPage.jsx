import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteOrganization, getOrganization, updateOrganization } from "../api";
import InviteList from "./InviteList";
import MemberList from "./MemberList";

export default function OrgSettingsPage({ token, user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [editName, setEditName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = org?.role === "admin";

  useEffect(() => {
    loadOrg();
  }, [id]);

  async function loadOrg() {
    try {
      const data = await getOrganization(token, id);
      setOrg(data);
      setEditName(data.name);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    setError("");
    try {
      const updated = await updateOrganization(token, id, editName);
      setOrg(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    try {
      await deleteOrganization(token, id);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!org) {
    return (
      <div className="settings-page">
        {error ? <p className="message message--error">{error}</p> : <p>Loading...</p>}
      </div>
    );
  }

  return (
    <div className="settings-page">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate("/dashboard")}>
        &larr; Back to dashboard
      </button>

      <div className="settings-section">
        <h2 className="settings-title">{org.name}</h2>
        <p className="settings-meta">
          Your role: <strong>{org.role}</strong>
        </p>

        {error && <p className="message message--error">{error}</p>}

        {isAdmin && (
          <div className="settings-actions">
            {isEditing ? (
              <form className="inline-form" onSubmit={handleRename}>
                <input
                  className="field-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  minLength={1}
                  maxLength={255}
                  required
                />
                <button type="submit" className="btn btn--primary btn--sm">
                  Save
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(true)}>
                Rename
              </button>
            )}
            <button type="button" className="btn btn--danger btn--sm" onClick={handleDelete}>
              Delete organization
            </button>
          </div>
        )}
      </div>

      <MemberList token={token} orgId={Number(id)} currentUserId={user.id} isAdmin={isAdmin} />
      <InviteList token={token} orgId={Number(id)} isAdmin={isAdmin} />
    </div>
  );
}
