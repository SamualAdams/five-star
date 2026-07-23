import { useState } from "react";

export default function OrganizationSwitcher({ organizations, currentOrgId, onOrgChange }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!organizations.length) return null;

  const currentOrg = organizations.find((org) => org.id === currentOrgId);
  const displayLabel = currentOrg ? `${currentOrg.name} (${currentOrg.role})` : "Select org";

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="org-switcher"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Switch organization"
        aria-expanded={isOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{displayLabel}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--color-neutral)" }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            minWidth: "100%",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            background: "var(--color-white)",
            boxShadow: "0 4px 12px color-mix(in srgb, var(--color-ink) 10%, transparent)",
            zIndex: 40,
            overflow: "hidden",
          }}
        >
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                onOrgChange(org.id);
                setIsOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 0.8rem",
                border: "none",
                background: org.id === currentOrgId ? "var(--color-primary-soft)" : "var(--color-white)",
                cursor: "pointer",
                fontSize: "0.95rem",
                color: "var(--color-ink)",
                fontWeight: org.id === currentOrgId ? 700 : 400,
                borderBottom: "1px solid var(--color-border-muted)",
              }}
              onMouseEnter={(e) => (e.target.style.background = "var(--color-surface-alt)")}
              onMouseLeave={(e) =>
                (e.target.style.background =
                  org.id === currentOrgId ? "var(--color-primary-soft)" : "var(--color-white)")
              }
            >
              {org.name} ({org.role})
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
