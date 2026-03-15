import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { acceptInvite, getInviteInfo } from "../api";

export default function InviteAcceptPage({ token, isAuthenticated }) {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getInviteInfo(inviteToken);
        setInfo(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [inviteToken]);

  async function handleAccept() {
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&invite=${inviteToken}`);
      return;
    }
    setError("");
    setIsAccepting(true);
    try {
      await acceptInvite(token, inviteToken);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAccepting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <p>Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <h2 className="invite-title">Invalid Invite</h2>
          <p className="message message--error">{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate("/")}>
            Go to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        <h2 className="invite-title">You've been invited!</h2>
        <p className="invite-detail">
          Join <strong>{info.organization_name}</strong> as a <strong>{info.role}</strong>
        </p>

        {error && <p className="message message--error">{error}</p>}

        <button type="button" className="btn btn--primary" onClick={handleAccept} disabled={isAccepting}>
          {!isAuthenticated ? "Sign up to accept" : isAccepting ? "Joining..." : "Accept invite"}
        </button>
      </div>
    </div>
  );
}
