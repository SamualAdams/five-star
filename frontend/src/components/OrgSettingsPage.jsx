import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deleteOrganization,
  getOrganization,
  updateOrgReviewLinks,
  updateLocationReviewLinks,
  updateLocationFiveStarStatus,
  updateOrganization,
  updateOrganizationFiveStarStatus,
  updateOrganizationModules,
} from "../api";
import InviteList from "./InviteList";
import MemberList from "./MemberList";
import PortalPageHeader from "./PortalPageHeader";

const PLATFORM_LABELS = { google: "Google Reviews", yelp: "Yelp", tripadvisor: "TripAdvisor" };
const PLATFORMS = Object.keys(PLATFORM_LABELS);
const ACCESS_ROLE_LABELS = {
  organization_admin: "Organization admin",
  organization_viewer: "Organization viewer",
  location_admin: "Location admin",
  location_viewer: "Location viewer",
};

function reviewLinksToInputs(reviewLinks) {
  const inputs = { google: "", yelp: "", tripadvisor: "" };
  for (const link of reviewLinks || []) {
    if (link.platform in inputs) inputs[link.platform] = link.url;
  }
  return inputs;
}

const SECTION_COPY = {
  general: {
    eyebrow: "Admin",
    title: "Settings",
    description: "Manage your organization identity and public links.",
  },
  users: {
    eyebrow: "Admin",
    title: "Users",
    description: "Manage the people who can access this organization.",
  },
  reviews: {
    eyebrow: "Admin",
    title: "Public reviews",
    description: "Choose where happy customers can leave a public review.",
  },
};

function PageHeading({ section }) {
  const copy = SECTION_COPY[section] || SECTION_COPY.general;
  return (
    <PortalPageHeader
      description={copy.description}
      eyebrow={copy.eyebrow}
      title={copy.title}
    />
  );
}

export default function OrgSettingsPage({
  section = "general",
  token,
  user,
  locations = [],
  currentLocation = null,
  canManageLocation = false,
  onOrganizationUpdated,
  onLocationUpdated,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [editName, setEditName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [linkInputs, setLinkInputs] = useState({ google: "", yelp: "", tripadvisor: "" });
  const [reviewLinksError, setReviewLinksError] = useState("");
  const [reviewLinksSaved, setReviewLinksSaved] = useState(false);
  const [moduleWorking, setModuleWorking] = useState("");
  const [moduleError, setModuleError] = useState("");
  const [fiveStarWorking, setFiveStarWorking] = useState(false);
  const [fiveStarError, setFiveStarError] = useState("");
  const [fiveStarSaved, setFiveStarSaved] = useState(false);

  const isAdmin = Boolean(org?.can_manage_organization);
  const canManageReviews = isAdmin || canManageLocation;

  useEffect(() => {
    let active = true;
    async function loadOrg() {
      try {
        const data = await getOrganization(token, id);
        if (!active) return;
        setOrg(data);
        setEditName(data.name);
        setLinkInputs(reviewLinksToInputs(currentLocation?.review_links ?? data.review_links));
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    loadOrg();
    return () => { active = false; };
  }, [id, token, currentLocation?.id]);

  async function handleSaveReviewLinks(event) {
    event.preventDefault();
    setReviewLinksError("");
    setReviewLinksSaved(false);
    const updated = PLATFORMS
      .filter((platform) => linkInputs[platform].trim())
      .map((platform) => ({ platform, url: linkInputs[platform].trim() }));
    try {
      if (currentLocation) {
        const savedLocation = await updateLocationReviewLinks(token, id, currentLocation.id, updated);
        setLinkInputs(reviewLinksToInputs(savedLocation.review_links));
        onLocationUpdated?.(savedLocation);
      } else {
        const savedOrganization = await updateOrgReviewLinks(token, id, updated);
        setOrg(savedOrganization);
        setLinkInputs(reviewLinksToInputs(savedOrganization.review_links));
        onOrganizationUpdated?.(savedOrganization);
      }
      setReviewLinksSaved(true);
      setTimeout(() => setReviewLinksSaved(false), 2000);
    } catch (err) {
      setReviewLinksError(err.message);
    }
  }

  async function handleUseOrganizationReviewLinks() {
    if (!currentLocation) return;
    setReviewLinksError("");
    setReviewLinksSaved(false);
    try {
      const savedLocation = await updateLocationReviewLinks(token, id, currentLocation.id, null);
      setLinkInputs(reviewLinksToInputs(savedLocation.review_links));
      onLocationUpdated?.(savedLocation);
      setReviewLinksSaved(true);
      setTimeout(() => setReviewLinksSaved(false), 2000);
    } catch (err) {
      setReviewLinksError(err.message);
    }
  }

  async function handleRename(event) {
    event.preventDefault();
    setError("");
    try {
      const updated = await updateOrganization(token, id, { name: editName });
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

  async function handleModuleToggle(moduleName, enabled) {
    setModuleWorking(moduleName);
    setModuleError("");
    try {
      const updated = await updateOrganizationModules(token, id, {
        [moduleName]: enabled,
      });
      setOrg(updated);
      onOrganizationUpdated?.(updated);
    } catch (err) {
      setModuleError(err.message);
    } finally {
      setModuleWorking("");
    }
  }

  async function handleFiveStarStatus(status) {
    setFiveStarWorking(true);
    setFiveStarError("");
    setFiveStarSaved(false);
    try {
      if (currentLocation) {
        const updatedLocation = await updateLocationFiveStarStatus(
          token,
          id,
          currentLocation.id,
          status
        );
        onLocationUpdated?.(updatedLocation);
      } else {
        const updatedOrganization = await updateOrganizationFiveStarStatus(token, id, status);
        setOrg(updatedOrganization);
        onOrganizationUpdated?.(updatedOrganization);
      }
      setFiveStarSaved(true);
      setTimeout(() => setFiveStarSaved(false), 2000);
    } catch (err) {
      setFiveStarError(err.message);
    } finally {
      setFiveStarWorking(false);
    }
  }

  if (!org) {
    return (
      <div className="settings-page">
        {error ? <p className="message message--error">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  return (
    <div className="settings-page">
      <PageHeading section={section} />
      {error && <p className="message message--error">{error}</p>}

      {section === "general" && (
        <>
          <div className="settings-section">
            <h2 className="settings-title">{org.name}</h2>
            <p className="settings-meta">Your role: <strong>{user.is_superuser ? "Platform superuser" : ACCESS_ROLE_LABELS[org.role] || org.role}</strong></p>
            {isAdmin && (
              <div className="settings-actions">
                {isEditing ? (
                  <form className="inline-form" onSubmit={handleRename}>
                    <input
                      className="field-input"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      minLength={1}
                      maxLength={255}
                      required
                    />
                    <button type="submit" className="btn btn--primary btn--sm">Save</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>Cancel</button>
                  </form>
                ) : (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(true)}>Rename</button>
                )}
                <button type="button" className="btn btn--danger btn--sm" onClick={handleDelete}>Delete organization</button>
              </div>
            )}
          </div>

          {user.is_superuser && (
            <>
              <div className="settings-section five-star-status-controls" id="five-star-status">
                <div className="organization-modules-heading">
                  <div>
                    <p className="dashboard-kicker">Platform controls</p>
                    <h3 className="settings-heading">five* status</h3>
                    <p className="settings-meta">
                      {currentLocation
                        ? `${currentLocation.name} currently has status ${currentLocation.five_star_status} of 5${currentLocation.five_star_status_override == null ? `, inherited from ${org.name}.` : "."}`
                        : `Set the default journey status for ${org.name} and every location without an override.`}
                    </p>
                  </div>
                  <span className="status-pill status-pill--connected">Superuser</span>
                </div>
                <div className="five-star-status-picker" role="group" aria-label="five* status">
                  {[0, 1, 2, 3, 4, 5].map((status) => {
                    const activeStatus = currentLocation?.five_star_status ?? org.five_star_status;
                    return (
                      <button
                        aria-pressed={activeStatus === status}
                        className={`five-star-status-option${activeStatus === status ? " five-star-status-option--active" : ""}`}
                        disabled={fiveStarWorking}
                        key={status}
                        onClick={() => handleFiveStarStatus(status)}
                        type="button"
                      >
                        <strong>{status}</strong>
                        <span>{status === 0 ? "not verified" : status === 1 ? "star" : "stars"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="five-star-status-footer">
                  <span className="settings-meta">
                    {currentLocation
                      ? currentLocation.five_star_status_override == null
                        ? `Using ${org.name}’s organization status.`
                        : `This location overrides ${org.name}’s status ${org.five_star_status}.`
                      : "Locations inherit this status unless a superuser overrides them."}
                  </span>
                  {currentLocation?.five_star_status_override != null && (
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={fiveStarWorking}
                      onClick={() => handleFiveStarStatus(null)}
                      type="button"
                    >
                      Use organization status
                    </button>
                  )}
                </div>
                {fiveStarWorking && <p className="settings-meta">Saving status…</p>}
                {fiveStarSaved && <p className="message message--success">five* status saved.</p>}
                {fiveStarError && <p className="message message--error">{fiveStarError}</p>}
              </div>

              <div className="settings-section organization-modules" id="modules">
                <div className="organization-modules-heading">
                  <div>
                    <p className="dashboard-kicker">Platform controls</p>
                    <h3 className="settings-heading">Modules</h3>
                    <p className="settings-meta">Choose which five* workspace modules this organization can use.</p>
                  </div>
                  <span className="status-pill status-pill--connected">Superuser</span>
                </div>
                <div className="organization-module-list">
                  <div className="organization-module-row">
                    <div>
                      <strong>Feedback</strong>
                      <small>Core feedback collection, reporting, and dashboard analytics.</small>
                    </div>
                    <label className="module-switch module-switch--fixed">
                      <input checked disabled type="checkbox" />
                      <span aria-hidden="true" />
                      <em>Included</em>
                    </label>
                  </div>
                  {[
                    {
                      key: "roadmap",
                      name: "Roadmap",
                      description: "Public initiatives, customer voting, and roadmap analytics.",
                    },
                    {
                      key: "feed",
                      name: "Feed",
                      description: "Post updates to your public five* page, with scheduling and publishing history.",
                    },
                  ].map((module) => (
                    <div className="organization-module-row" key={module.key}>
                      <div>
                        <strong>{module.name}</strong>
                        <small>{module.description}</small>
                      </div>
                      <label className="module-switch">
                        <input
                          aria-label={`${module.name} module`}
                          checked={Boolean(org.modules?.[module.key])}
                          disabled={Boolean(moduleWorking)}
                          onChange={(event) => handleModuleToggle(module.key, event.target.checked)}
                          type="checkbox"
                        />
                        <span aria-hidden="true" />
                        <em>{moduleWorking === module.key ? "Saving…" : org.modules?.[module.key] ? "Enabled" : "Locked"}</em>
                      </label>
                    </div>
                  ))}
                </div>
                {moduleError && <p className="message message--error">{moduleError}</p>}
              </div>
            </>
          )}

          {isAdmin && (
            <div className="settings-section">
              <h3 className="settings-heading">Location public links</h3>
              <p className="settings-meta">
                Each location has a direct feedback URL and can override review destinations.
                The public landing page is organization-wide.
              </p>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => navigate(`/org/${id}/locations`)}
                style={{ marginTop: "1rem" }}
              >
                Manage locations
              </button>
            </div>
          )}
        </>
      )}

      {section === "users" && (
        <>
          <MemberList
            token={token}
            orgId={Number(id)}
            currentUserId={user.id}
            isAdmin={isAdmin}
            locations={locations}
          />
          <InviteList token={token} orgId={Number(id)} isAdmin={isAdmin} locations={locations} />
        </>
      )}

      {section === "reviews" && canManageReviews && (
        <div className="settings-section review-destinations-section">
          <div className="review-destinations-heading">
            <div>
              <h3 className="settings-heading">
                {currentLocation ? `Review destinations for ${currentLocation.name}` : "Organization review destinations"}
              </h3>
              <p className="settings-meta">
                {currentLocation
                  ? currentLocation.review_links_override == null
                    ? `These links are inherited from ${org.name}. Saving changes creates a location-specific override.`
                    : `These links override ${org.name}’s organization defaults for this location.`
                  : "Set the default destinations for every location. Locations can override these only when needed."}
              </p>
            </div>
            {currentLocation && (
              <span className={`review-inheritance-badge${currentLocation.review_links_override == null ? "" : " review-inheritance-badge--override"}`}>
                {currentLocation.review_links_override == null ? "Inherited" : "Location override"}
              </span>
            )}
          </div>
          <form className="review-links-form" onSubmit={handleSaveReviewLinks}>
            {PLATFORMS.map((platform) => (
              <div key={platform} className="review-link-row">
                <label className="review-link-label" htmlFor={`review-link-${platform}`}>{PLATFORM_LABELS[platform]}</label>
                <input
                  className="field-input"
                  id={`review-link-${platform}`}
                  type="url"
                  placeholder={
                    platform === "google"
                      ? "https://g.page/your-business/review"
                      : platform === "yelp"
                        ? "https://yelp.com/biz/your-business"
                        : "https://tripadvisor.com/your-listing"
                  }
                  value={linkInputs[platform]}
                  onChange={(event) => setLinkInputs((current) => ({ ...current, [platform]: event.target.value }))}
                />
              </div>
            ))}
            {reviewLinksError && <p className="message message--error">{reviewLinksError}</p>}
            <div className="review-links-actions">
              <button type="submit" className="btn btn--primary btn--sm">
                {reviewLinksSaved
                  ? "Saved!"
                  : currentLocation
                    ? currentLocation.review_links_override == null
                      ? "Save location override"
                      : "Save location links"
                    : "Save organization defaults"}
              </button>
              {currentLocation?.review_links_override != null && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleUseOrganizationReviewLinks}>
                  Use organization defaults
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {!isAdmin && section !== "users" && !(section === "reviews" && canManageReviews) && (
        <div className="settings-section">
          <h3 className="settings-heading">Admin access required</h3>
          <p className="settings-meta">Only organization admins can manage this section.</p>
        </div>
      )}
    </div>
  );
}
