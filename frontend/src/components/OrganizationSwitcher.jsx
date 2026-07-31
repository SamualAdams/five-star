import { useState } from "react";

const ACCESS_ROLE_LABELS = {
  organization_admin: "Organization admin",
  organization_viewer: "Organization viewer",
  location_admin: "Location admin",
  location_viewer: "Location viewer",
};

export default function OrganizationSwitcher({
  organizations,
  currentOrgId,
  onCreateOrganization,
  onOrgChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (!organizations.length) return null;

  const currentOrg = organizations.find((org) => org.id === currentOrgId);
  const displayLabel = currentOrg
    ? `${currentOrg.name} (${ACCESS_ROLE_LABELS[currentOrg.role] || currentOrg.role})`
    : "Select organization";

  function chooseOrganization(orgId) {
    onOrgChange(orgId);
    setIsOpen(false);
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
            <p className="organization-switcher-heading">Your organizations</p>
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                className={`organization-switcher-option${org.id === currentOrgId ? " organization-switcher-option--active" : ""}`}
                onClick={() => chooseOrganization(org.id)}
              >
                <span>
                  <strong>{org.name}</strong>
                  <small>{ACCESS_ROLE_LABELS[org.role] || org.role}</small>
                </span>
                {org.id === currentOrgId && <span aria-hidden="true">✓</span>}
              </button>
            ))}
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
