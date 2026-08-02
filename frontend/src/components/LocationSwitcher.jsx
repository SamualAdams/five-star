import { useState } from "react";

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
        {locations.length > 1 && <span className="location-switcher-count">{locations.length}</span>}
        <span className="org-switcher-chevron" aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <>
          <div className="location-switcher-menu">
            <p className="organization-switcher-heading">Locations ({locations.length})</p>
            {canViewAll && (
              <button
                type="button"
                className={`organization-switcher-option${currentLocationId === "all" ? " organization-switcher-option--active" : ""}`}
                onClick={() => choose("all")}
              >
                <span>
                  <strong>All locations</strong>
                  <small>Organization-wide view</small>
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
                  <small>
                    {location.address || (location.is_default ? "Default location" : "Location")}
                    {location.access_role === "location_admin" ? " · You manage this location" : ""}
                  </small>
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
