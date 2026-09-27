import { useEffect, useState } from "react";
import { listLocations, listOrganizationFeedback } from "../api";

// Every individual message for the business, shown only to five* staff. Many
// businesses are unclaimed (created from the directory), so staff read and
// deliver this feedback themselves.
export default function StaffFeedbackList({ token, orgId, locationId }) {
  const [feedback, setFeedback] = useState(null);
  const [locationNames, setLocationNames] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setFeedback(null);
    setError("");
    Promise.all([listOrganizationFeedback(token, orgId, locationId), listLocations(token, orgId)])
      .then(([items, locations]) => {
        if (cancelled) return;
        setFeedback(items);
        setLocationNames(Object.fromEntries(locations.map((location) => [location.id, location.name])));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load feedback.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, orgId, locationId]);

  return (
    <div className="settings-section staff-feedback">
      <h3 className="settings-heading">All feedback</h3>
      <p className="settings-meta">Every message, newest first. Only five* staff see this list.</p>

      {error && <p className="message message--error">{error}</p>}
      {!error && feedback === null && <p className="settings-meta">Loading…</p>}
      {feedback?.length === 0 && <p className="settings-meta">No feedback yet.</p>}

      {feedback?.length > 0 && (
        <ul className="staff-feedback-list">
          {feedback.map((item) => (
            <li key={item.id} className="staff-feedback-item">
              <p className="staff-feedback-content">{item.content}</p>
              <p className="staff-feedback-meta">
                {new Date(item.created_at.endsWith("Z") ? item.created_at : `${item.created_at}Z`).toLocaleString()}
                {" · "}
                {item.location_id ? locationNames[item.location_id] || "Location" : "Whole business"}
                {" · "}
                {item.is_anonymous
                  ? "Anonymous"
                  : [item.submitter_name, item.submitter_email].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
