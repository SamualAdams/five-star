import { useState } from "react";

const ACCESS_ROLE_LABELS = {
  organization_admin: "Organization admin",
  organization_viewer: "Organization viewer",
  location_admin: "Location admin",
  location_viewer: "Location viewer",
};

export default function LocationSwitcher({
  canViewAll,
  currentLocationId,
  locations,
  onLocationChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (!locations.length) return null;

  const currentLocation = locations.find((location) => location.id === Number(currentLocationId));
  const label = currentLocationId === "all"
    ? "All locations"
    : currentLocation?.name || "Select location";

  function choose(value) {
    onLocationChange(value);
    setIsOpen(false);
  }

  return (
    <div className="location-switcher-wrap">
      <button
        type="button"
        className="location-switcher"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Change location scope"
        aria-expanded={isOpen}
      >
        <span className="location-switcher-pin" aria-hidden="true">⌖</span>
        <span>{label}</span>
        <span className="org-switcher-chevron" aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <>
          <div className="location-switcher-menu">
            <p className="organization-switcher-heading">Location scope</p>
            {canViewAll && (
              <button
                type="button"
                className={`organization-switcher-option${currentLocationId === "all" ? " organization-switcher-option--active" : ""}`}
                onClick={() => choose("all")}
              >
                <span>
                  <strong>All locations</strong>
                  <small>Organization rollup</small>
                </span>
                {currentLocationId === "all" && <span aria-hidden="true">✓</span>}
              </button>
            )}
            {locations.map((location) => (
              <button
                type="button"
                className={`organization-switcher-option${Number(currentLocationId) === location.id ? " organization-switcher-option--active" : ""}`}
                key={location.id}
                onClick={() => choose(location.id)}
              >
                <span>
                  <strong>{location.name}</strong>
                  <small>{ACCESS_ROLE_LABELS[location.access_role] || location.access_role}</small>
                </span>
                {Number(currentLocationId) === location.id && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="organization-switcher-backdrop"
            onClick={() => setIsOpen(false)}
            aria-label="Close location menu"
          />
        </>
      )}
    </div>
  );
}
