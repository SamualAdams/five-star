import { useEffect, useState } from "react";
import { createInvite, listInvites } from "../api";

const ACCESS_ROLE_LABELS = {
  organization_admin: "Organization admin",
  organization_viewer: "Organization viewer",
  location_admin: "Location admin",
  location_viewer: "Location viewer",
};

export default function InviteList({ token, orgId, isAdmin, locations = [] }) {
  const [invites, setInvites] = useState([]);
  const [newRole, setNewRole] = useState("location_admin");
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (isAdmin) loadInvites();
  }, [orgId, isAdmin]);

  useEffect(() => {
    if (!locationId && locations[0]) setLocationId(locations[0].id);
  }, [locationId, locations]);

  async function loadInvites() {
    try {
      const data = await listInvites(token, orgId);
      setInvites(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate() {
    setError("");
    try {
      const isLocationInvite = newRole.startsWith("location_");
      await createInvite(
        token,
        orgId,
        newRole,
        168,
        isLocationInvite ? Number(locationId) : null,
      );
      await loadInvites();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCopy(url, inviteId) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(inviteId);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Failed to copy");
    }
  }

  function inviteStatus(inv) {
    if (inv.used_at) return "used";
    const now = new Date();
    if (new Date(inv.expires_at) < now) return "expired";
    return "active";
  }

  if (!isAdmin) return null;

  return (
    <div className="settings-section">
      <h3 className="settings-heading">Invite users</h3>
      {error && <p className="message message--error">{error}</p>}

      <div className="invite-create">
        <select className="role-select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
          {Object.entries(ACCESS_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {newRole.startsWith("location_") && (
          <select className="role-select" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        )}
        <button type="button" className="btn btn--primary btn--sm" onClick={handleCreate}>
          Generate invite link
        </button>
      </div>

      {invites.length > 0 && (
        <div className="settings-table-scroll">
          <table className="members-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const st = inviteStatus(inv);
                return (
                  <tr key={inv.id}>
                    <td>{ACCESS_ROLE_LABELS[inv.role] || inv.role}</td>
                    <td>{inv.location_name || "All locations"}</td>
                    <td>
                      <span className={`invite-status invite-status--${st}`}>{st}</span>
                    </td>
                    <td>{new Date(inv.expires_at).toLocaleDateString()}</td>
                    <td>
                      {st === "active" && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => handleCopy(inv.invite_url, inv.id)}
                        >
                          {copied === inv.id ? "Copied!" : "Copy link"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
