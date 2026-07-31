import { useEffect, useState } from "react";
import {
  listMembers,
  removeMember,
  updateMemberLocationAssignments,
  updateMemberRole,
} from "../api";

const ACCESS_ROLE_LABELS = {
  organization_admin: "Organization admin",
  organization_viewer: "Organization viewer",
  location_admin: "Location admin",
  location_viewer: "Location viewer",
};

function LocationAccessEditor({ locations, member, onSave }) {
  const [assignments, setAssignments] = useState(() => (
    Object.fromEntries((member.location_assignments || []).map((item) => [item.location_id, true]))
  ));
  const [isSaving, setIsSaving] = useState(false);
  const locationRole = member.role === "location_admin" ? "manager" : "viewer";

  async function save() {
    setIsSaving(true);
    try {
      await onSave(
        Object.keys(assignments).map((locationId) => ({
          location_id: Number(locationId),
          role: locationRole,
        }))
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <details className="member-location-access">
      <summary>
        {(member.location_assignments || []).length} location{(member.location_assignments || []).length === 1 ? "" : "s"}
      </summary>
      <div className="member-location-menu">
        {locations.map((location) => (
          <label className="member-location-option" key={location.id}>
            <input
              type="checkbox"
              checked={Boolean(assignments[location.id])}
              onChange={(event) => setAssignments((current) => {
                const next = { ...current };
                if (event.target.checked) next[location.id] = true;
                else delete next[location.id];
                return next;
              })}
            />
            <span>{location.name}</span>
          </label>
        ))}
        <button className="btn btn--primary btn--sm" type="button" onClick={save} disabled={isSaving || !Object.keys(assignments).length}>
          {isSaving ? "Saving…" : "Save access"}
        </button>
      </div>
    </details>
  );
}

export default function MemberList({ token, orgId, currentUserId, isAdmin, locations = [] }) {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMembers();
  }, [orgId]);

  async function loadMembers() {
    try {
      const data = await listMembers(token, orgId);
      setMembers(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRoleChange(userId, newRole) {
    setError("");
    try {
      await updateMemberRole(token, orgId, userId, newRole);
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(userId) {
    setError("");
    const isSelf = userId === currentUserId;
    const msg = isSelf ? "Leave this organization?" : "Remove this member?";
    if (!window.confirm(msg)) return;
    try {
      await removeMember(token, orgId, userId);
      if (isSelf) {
        window.location.reload();
      } else {
        await loadMembers();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssignments(userId, assignments) {
    setError("");
    try {
      const updated = await updateMemberLocationAssignments(token, orgId, userId, assignments);
      setMembers((current) => current.map((member) => (
        member.user_id === userId ? updated : member
      )));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  return (
    <div className="settings-section">
      <h3 className="settings-heading">Users</h3>
      {error && <p className="message message--error">{error}</p>}

      <div className="settings-table-scroll">
        <table className="members-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Locations</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className={m.user_id === currentUserId ? "members-row--self" : ""}>
                <td>{m.email}</td>
                <td>
                  {isAdmin ? (
                    <select
                      className="role-select"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                    >
                      {Object.entries(ACCESS_ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    ACCESS_ROLE_LABELS[m.role] || m.role
                  )}
                </td>
                <td>
                  {m.role.startsWith("organization_") ? (
                    <span className="member-all-locations">All locations</span>
                  ) : isAdmin ? (
                    <LocationAccessEditor
                      locations={locations}
                      member={m}
                      onSave={(assignments) => handleAssignments(m.user_id, assignments)}
                    />
                  ) : (
                    `${(m.location_assignments || []).length} assigned`
                  )}
                </td>
                <td>{new Date(m.joined_at).toLocaleDateString()}</td>
                <td>
                  {(isAdmin || m.user_id === currentUserId) && (
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => handleRemove(m.user_id)}
                    >
                      {m.user_id === currentUserId ? "Leave" : "Remove"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
