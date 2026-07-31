import { Link } from "react-router-dom";

export default function DashboardWidget({ children, description, icon, title, to }) {
  return (
    <Link className="dashboard-widget" to={to}>
      <span className="dashboard-widget-icon">{icon}</span>
      <div className="dashboard-widget-copy">
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
      <span className="dashboard-widget-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
