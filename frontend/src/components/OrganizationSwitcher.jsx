import { useState } from "react";

const ACCESS_ROLE_LABELS = {
  organization_admin: "Organization admin",
  organization_viewer: "Organization viewer",
  location_admin: "Location admin",
  location_viewer: "Location viewer",
};

// "Raising Cane's" -> "raising canes", so "canes" and "chick fil a" match.
function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function OrganizationSwitcher({
  organizations,
  currentOrgId,
  isSuperuser = false,
  onCreateOrganization,
  onOrgChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  if (!organizations.length) return null;

  // Staff see every business on five*, including unclaimed ones created from
  // the directory, so the list gets long enough to need a filter.
  const showFilter = isSuperuser || organizations.length > 8;
  const filterText = normalizeName(filter);
  const visibleOrganizations = filterText
    ? organizations.filter((org) => normalizeName(org.name).includes(filterText))
    : organizations;

  function roleLabel(org) {
    if (isSuperuser) return org.is_claimed === false ? "Unclaimed · from directory" : "Claimed";
    return ACCESS_ROLE_LABELS[org.role] || org.role;
  }

  const currentOrg = organizations.find((org) => org.id === currentOrgId);
  const displayLabel = currentOrg
    ? `${currentOrg.name} (${ACCESS_ROLE_LABELS[currentOrg.role] || currentOrg.role})`
    : "Select organization";

  function chooseOrganization(orgId) {
    onOrgChange(orgId);
    setIsOpen(false);
    setFilter("");
  }

  return (
    <div className="organization-switcher-wrap">
      <button
        type="button"
        className="org-switcher"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Switch organization"
        aria-expanded={isOpen}
      >
        <span>{displayLabel}</span>
        <span className="org-switcher-chevron" aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <>
          <div className="organization-switcher-menu">
            <p className="organization-switcher-heading">
              {isSuperuser ? `All businesses (${organizations.length})` : "Your organizations"}
            </p>
            {showFilter && (
              <input
                type="search"
                className="organization-switcher-filter"
                placeholder="Search businesses…"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Search businesses"
                autoFocus
              />
            )}
            <div className="organization-switcher-list">
              {visibleOrganizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  className={`organization-switcher-option${org.id === currentOrgId ? " organization-switcher-option--active" : ""}`}
                  onClick={() => chooseOrganization(org.id)}
                >
                  <span>
                    <strong>{org.name}</strong>
                    <small className={org.is_claimed === false && isSuperuser ? "organization-switcher-unclaimed" : undefined}>
                      {roleLabel(org)}
                    </small>
                  </span>
                  {org.id === currentOrgId && <span aria-hidden="true">✓</span>}
                </button>
              ))}
              {!visibleOrganizations.length && (
                <p className="organization-switcher-empty">No businesses match “{filter}”.</p>
              )}
            </div>
            <button
              type="button"
              className="organization-switcher-create"
              onClick={() => {
                setIsOpen(false);
                onCreateOrganization();
              }}
            >
              <span aria-hidden="true">＋</span>
              Create organization
            </button>
          </div>
          <button
            type="button"
            className="organization-switcher-backdrop"
            onClick={() => setIsOpen(false)}
            aria-label="Close organization menu"
          />
        </>
      )}
    </div>
  );
}
