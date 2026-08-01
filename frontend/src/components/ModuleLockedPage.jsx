import { Link } from "react-router-dom";

export default function ModuleLockedPage({ isSuperuser, moduleName, orgId }) {
  return (
    <div className="module-locked-page">
      <div className="module-locked-card">
        <span className="module-lock-mark" aria-hidden="true">🔒</span>
        <p className="dashboard-kicker">Module locked</p>
        <h1>{moduleName} is not enabled</h1>
        <p>
          {isSuperuser
            ? `Enable the ${moduleName} module in this organization’s Settings to open it.`
            : `This organization does not currently include the ${moduleName} module. Contact Five* to enable it.`}
        </p>
        {isSuperuser ? (
          <Link className="btn btn--primary" to={`/org/${orgId}/settings#modules`}>
            Enable in Settings
          </Link>
        ) : (
          <Link className="btn btn--ghost" to="/dashboard">Back to dashboard</Link>
        )}
      </div>
    </div>
  );
}
