import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getOrganizationFeedbackFormInfo,
  polishOrganizationReview,
  submitOrganizationFeedback,
} from "../api";
import { FeedbackExperience } from "./FeedbackPage";

export default function OrganizationFeedbackPage() {
  const { organizationToken } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [organizationSelected, setOrganizationSelected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setInfo(null);
    setError("");
    getOrganizationFeedbackFormInfo(organizationToken)
      .then((data) => {
        if (!active) return;
        if (data.locations.length === 1) {
          navigate(`/feedback/${data.locations[0].feedback_token}`, { replace: true });
          return;
        }
        setInfo(data);
        if (data.locations.length === 0) setOrganizationSelected(true);
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [navigate, organizationToken]);

  if (error) {
    return <div className="feedback-page"><div className="feedback-card"><h2>Organization not found</h2><p className="message message--error">{error}</p></div></div>;
  }
  if (!info) {
    return <div className="feedback-page"><div className="feedback-card"><p>Loading...</p></div></div>;
  }
  if (organizationSelected) {
    const organizationInfo = { ...info, location_name: "Organization overall", location_id: null };
    return (
      <FeedbackExperience
        info={organizationInfo}
        onSubmit={(content, email, name) => submitOrganizationFeedback(organizationToken, content, email, name)}
        onPolish={(content, style) => polishOrganizationReview(organizationToken, content, style)}
        onChangeDestination={info.locations.length > 0 ? () => setOrganizationSelected(false) : null}
      />
    );
  }

  return (
    <div className="feedback-page feedback-destination-page">
      <div className="feedback-card feedback-destination-card">
        <p className="board-eyebrow">Private by design</p>
        <h1 className="feedback-title">Where is your feedback for?</h1>
        <p className="feedback-subtitle">
          Choose <strong>{info.organization_name}</strong> overall, or send it to a specific location.
        </p>
        <div className="public-location-list">
          <button className="public-location-card public-location-card--button" onClick={() => setOrganizationSelected(true)} type="button">
            <span className="public-location-mark" aria-hidden="true">*</span>
            <span><strong>{info.organization_name}</strong><small>Organization overall</small></span>
            <span aria-hidden="true">→</span>
          </button>
          {info.locations.map((location) => (
            <button
              className="public-location-card public-location-card--button"
              key={location.id}
              onClick={() => navigate(`/feedback/${location.feedback_token}`)}
              type="button"
            >
              <span className="public-location-mark" aria-hidden="true">⌖</span>
              <span><strong>{location.name}</strong>{location.address && <small>{location.address}</small>}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
