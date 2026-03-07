import { useEffect, useState } from "react";
import { createInvite, listInvites } from "../api";

export default function InviteList({ token, orgId, isAdmin }) {
  const [invites, setInvites] = useState([]);
  const [newRole, setNewRole] = useState("viewer");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (isAdmin) loadInvites();
  }, [orgId, isAdmin]);

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
      await createInvite(token, orgId, newRole);
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
      <h3 className="settings-heading">Invite Links</h3>
      {error && <p className="message message--error">{error}</p>}

      <div className="invite-create">
        <select className="role-select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
          <option value="viewer">viewer</option>
          <option value="admin">admin</option>
        </select>
        <button type="button" className="btn btn--primary btn--sm" onClick={handleCreate}>
          Generate invite link
        </button>
      </div>

      {invites.length > 0 && (
        <table className="members-table">
          <thead>
            <tr>
              <th>Role</th>
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
                  <td>{inv.role}</td>
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
      )}
    </div>
  );
}
