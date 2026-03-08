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
        <span style={{ fontSize: "0.75rem", color: "#5e6770" }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            minWidth: "100%",
            border: "1px solid #d6dfe6",
            borderRadius: "12px",
            background: "white",
            boxShadow: "0 4px 12px rgba(45, 27, 66, 0.1)",
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
                background: org.id === currentOrgId ? "#f4f8fb" : "white",
                cursor: "pointer",
                fontSize: "0.95rem",
                color: "#2d1b42",
                fontWeight: org.id === currentOrgId ? 700 : 400,
                borderBottom: "1px solid #f0f3f6",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#f9fafb")}
              onMouseLeave={(e) =>
                (e.target.style.background =
                  org.id === currentOrgId ? "#f4f8fb" : "white")
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
