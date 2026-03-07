import { useEffect, useState } from "react";
import { listMembers, updateMemberRole, removeMember } from "../api";

export default function MemberList({ token, orgId, currentUserId, isAdmin }) {
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

  return (
    <div className="settings-section">
      <h3 className="settings-heading">Members</h3>
      {error && <p className="message message--error">{error}</p>}

      <table className="members-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
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
                    <option value="admin">admin</option>
                    <option value="viewer">viewer</option>
                  </select>
                ) : (
                  m.role
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
  );
}
