import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  beginSocialConnection,
  completeFacebookConnection,
  deleteOrganization,
  disconnectSocialConnection,
  getFacebookPageOptions,
  getOrganization,
  listSocialConnections,
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
  social: {
    eyebrow: "Admin",
    title: "Social accounts",
    description: "Connect the destinations used by your organization feed.",
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

const SOCIAL_MARKS = {
  facebook: "f",
  instagram: "ig",
  tiktok: "tt",
};

const IS_LOCAL_APP_HOST = typeof window !== "undefined"
  && ["localhost", "127.0.0.1"].includes(window.location.hostname);

function SocialAccountsManager({ token, orgId, currentLocation, organizationName }) {
  const locationId = currentLocation?.id || null;
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingProvider, setWorkingProvider] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [notice, setNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("social")) return null;
    return {
      type: params.get("social"),
      provider: params.get("provider"),
      message: params.get("message"),
      setup: params.get("setup"),
    };
  });
  const [metaSetup, setMetaSetup] = useState(() => (
    notice?.type === "selection_required" && notice?.provider === "facebook"
      ? notice.setup
      : ""
  ));
  const [metaPages, setMetaPages] = useState([]);
  const [selectedMetaPage, setSelectedMetaPage] = useState("");
  const [loadingMetaPages, setLoadingMetaPages] = useState(false);

  async function loadAccounts() {
    setConnectionError("");
    try {
      setAccounts(await listSocialConnections(token, orgId, locationId));
    } catch (err) {
      setConnectionError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, [token, orgId, locationId]);

  useEffect(() => {
    if (!notice) return;
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, [notice]);

  useEffect(() => {
    if (!metaSetup) return;
    let active = true;
    setLoadingMetaPages(true);
    setConnectionError("");
    getFacebookPageOptions(token, orgId, metaSetup)
      .then((result) => {
        if (!active) return;
        setMetaPages(result.pages || []);
        if (result.pages?.length === 1) setSelectedMetaPage(result.pages[0].id);
      })
      .catch((err) => {
        if (active) setConnectionError(err.message);
      })
      .finally(() => {
        if (active) setLoadingMetaPages(false);
      });
    return () => {
      active = false;
    };
  }, [metaSetup, token, orgId]);

  async function handleConnect(account) {
    setConnectionError("");
    setNotice(null);
    if (!account.publishing_enabled || !account.configured) return;
    setWorkingProvider(account.provider);
    try {
      const result = await beginSocialConnection(token, orgId, account.provider, locationId);
      window.location.assign(result.authorization_url);
    } catch (err) {
      setConnectionError(err.message);
      setWorkingProvider("");
    }
  }

  async function handleDisconnect(account) {
    const label = account.provider_account_name
      ? `${account.name} (${account.provider_account_name})`
      : account.name;
    if (!window.confirm(`Disconnect ${label}? Scheduled publishing to this destination will stop.`)) return;
    setWorkingProvider(account.provider);
    setConnectionError("");
    setNotice(null);
    try {
      await disconnectSocialConnection(token, orgId, account.provider, locationId);
      await loadAccounts();
    } catch (err) {
      setConnectionError(err.message);
    } finally {
      setWorkingProvider("");
    }
  }

  async function handleMetaPageComplete() {
    if (!metaSetup || !selectedMetaPage) return;
    setWorkingProvider("facebook");
    setConnectionError("");
    try {
      const updatedAccounts = await completeFacebookConnection(
        token,
        orgId,
        metaSetup,
        selectedMetaPage
      );
      setAccounts(updatedAccounts);
      setMetaSetup("");
      setMetaPages([]);
      setSelectedMetaPage("");
      setNotice({ type: "connected", provider: "facebook", message: null });
    } catch (err) {
      setConnectionError(err.message);
    } finally {
      setWorkingProvider("");
    }
  }

  return (
    <div className="settings-section social-account-list">
      <div className="settings-section-heading">
        <div>
          <h3 className="settings-heading">Publishing destinations</h3>
          <p className="settings-meta">
            {currentLocation
              ? `Choose the accounts used when publishing for ${currentLocation.name}. Organization accounts are inherited until you replace them here.`
              : "Choose the default accounts used when publishing for the organization."}
          </p>
        </div>
        {!loading && (
          <span className="social-connection-count">
            {accounts.filter((account) => account.connected).length} connected
          </span>
        )}
      </div>
      {notice?.type === "connected" && (
        <p className="message message--success">
          {accounts.find((account) => account.provider === notice.provider)?.name || "Social account"} connected.
        </p>
      )}
      {notice?.type === "error" && (
        <p className="message message--error">
          {notice.message || "The social account could not be connected."}
        </p>
      )}
      {metaSetup && (
        <div className="social-page-picker" role="region" aria-label="Choose a Facebook Page">
          <div>
            <strong>Choose the Facebook Page for this organization</strong>
            <p>
              Five* will publish to this Page. If it has a professional Instagram account linked,
              that destination will be connected automatically.
            </p>
          </div>
          {loadingMetaPages ? (
            <p className="settings-meta">Loading Pages…</p>
          ) : metaPages.length ? (
            <div className="social-page-options">
              {metaPages.map((page) => (
                <label
                  className={`social-page-option${selectedMetaPage === page.id ? " social-page-option--selected" : ""}`}
                  key={page.id}
                >
                  <input
                    checked={selectedMetaPage === page.id}
                    name="facebook-page"
                    onChange={() => setSelectedMetaPage(page.id)}
                    type="radio"
                    value={page.id}
                  />
                  <span>
                    <strong>{page.name}</strong>
                    <small>
                      {page.instagram?.username
                        ? `Instagram: @${page.instagram.username}`
                        : "No linked professional Instagram account found"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="message message--error">
              No Facebook Pages were returned for this account.
            </p>
          )}
          <div className="social-page-picker-actions">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setMetaSetup("");
                setMetaPages([]);
                setSelectedMetaPage("");
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn btn--primary btn--sm"
              disabled={!selectedMetaPage || workingProvider === "facebook"}
              onClick={handleMetaPageComplete}
              type="button"
            >
              {workingProvider === "facebook" ? "Connecting…" : "Use this Page"}
            </button>
          </div>
        </div>
      )}
      {connectionError && <p className="message message--error">{connectionError}</p>}
      {loading ? (
        <div className="social-accounts-loading" aria-live="polite">Loading connections…</div>
      ) : (
        accounts.map((account) => {
          const isWorking = workingProvider === account.provider;
          const requiresReconnect = account.status === "reconnect_required";
          const isComingSoon = !account.publishing_enabled;
          const isUnavailable = !account.configured && !isComingSoon;
          const unavailableLabel = IS_LOCAL_APP_HOST ? "Unavailable locally" : "Unavailable";
          return (
            <div className="social-account-row" key={account.provider}>
              <span className="social-account-mark" aria-hidden="true">
                {SOCIAL_MARKS[account.provider]}
              </span>
              <span className="social-account-copy">
                <span className="social-account-name-line">
                  <strong>{account.name}</strong>
                  {account.connected && !requiresReconnect && !isComingSoon && !isUnavailable && (
                    <span className="status-pill status-pill--connected">
                      {account.inherited ? "Inherited" : "Connected"}
                    </span>
                  )}
                  {requiresReconnect && !isComingSoon && !isUnavailable && (
                    <span className="status-pill status-pill--attention">Reconnect</span>
                  )}
                  {isComingSoon && (
                    <span className="status-pill status-pill--attention">Coming soon</span>
                  )}
                  {isUnavailable && (
                    <span className="status-pill status-pill--attention">{unavailableLabel}</span>
                  )}
                </span>
                <small>
                  {account.provider_account_name
                    ? `Connected as ${account.provider_account_name}`
                    : account.description}
                </small>
                {account.linked_page_name && (
                  <small>Linked through {account.linked_page_name}</small>
                )}
                {account.diagnostic && !isUnavailable && (
                  <small className="social-account-diagnostic">{account.diagnostic}</small>
                )}
                {isUnavailable && (
                  <small className="social-account-diagnostic">
                    {IS_LOCAL_APP_HOST
                      ? `${account.name} sign-in is not configured in this local environment. Use the deployed app to test the connection.`
                      : `${account.name} sign-in is temporarily unavailable.`}
                  </small>
                )}
                {isComingSoon && (
                  <small className="social-account-diagnostic">
                    TikTok account connections and publishing are coming soon.
                  </small>
                )}
              </span>
              <span className="social-account-actions">
                {account.connected && !account.inherited && (
                  <button
                    className="btn btn--text btn--sm"
                    type="button"
                    disabled={isWorking}
                    onClick={() => handleDisconnect(account)}
                  >
                    Disconnect
                  </button>
                )}
                {account.connected && account.configured && !isComingSoon && (
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    disabled={isWorking}
                    onClick={() => handleConnect(account)}
                  >
                    {isWorking
                      ? "Opening…"
                      : account.inherited
                        ? "Use different account"
                        : account.provider === "facebook"
                        ? "Change Page"
                        : "Reconnect"}
                  </button>
                )}
                {!account.connected && !isComingSoon && !isUnavailable && (
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    disabled={isWorking}
                    onClick={() => handleConnect(account)}
                  >
                    {isWorking ? "Opening…" : "Connect"}
                  </button>
                )}
                {isComingSoon && (
                  <button className="btn btn--ghost btn--sm" type="button" disabled>
                    Coming soon
                  </button>
                )}
                {isUnavailable && (
                  <button className="btn btn--ghost btn--sm" type="button" disabled>
                    {unavailableLabel}
                  </button>
                )}
              </span>
            </div>
          );
        })
      )}
      <p className="social-account-footnote">
        {currentLocation
          ? `${currentLocation.name} inherits ${organizationName} connections unless a location-specific account is connected.`
          : "These connections are inherited by every location that does not have its own account override."}
      </p>
    </div>
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
                    <h3 className="settings-heading">Five Star status</h3>
                    <p className="settings-meta">
                      {currentLocation
                        ? `${currentLocation.name} currently has status ${currentLocation.five_star_status} of 5${currentLocation.five_star_status_override == null ? `, inherited from ${org.name}.` : "."}`
                        : `Set the default journey status for ${org.name} and every location without an override.`}
                    </p>
                  </div>
                  <span className="status-pill status-pill--connected">Superuser</span>
                </div>
                <div className="five-star-status-picker" role="group" aria-label="Five Star status">
                  {[1, 2, 3, 4, 5].map((status) => {
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
                        <span>{status === 1 ? "star" : "stars"}</span>
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
                {fiveStarSaved && <p className="message message--success">Five Star status saved.</p>}
                {fiveStarError && <p className="message message--error">{fiveStarError}</p>}
              </div>

              <div className="settings-section organization-modules" id="modules">
                <div className="organization-modules-heading">
                  <div>
                    <p className="dashboard-kicker">Platform controls</p>
                    <h3 className="settings-heading">Modules</h3>
                    <p className="settings-meta">Choose which Five* workspace modules this organization can use.</p>
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
                      description: "Social accounts, post creation, scheduling, and publishing history.",
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
                The public landing page is organization-wide, and social connections can be replaced per location.
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

      {section === "social" && isAdmin && (
        <SocialAccountsManager
          token={token}
          orgId={Number(id)}
          currentLocation={currentLocation}
          organizationName={org.name}
        />
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
