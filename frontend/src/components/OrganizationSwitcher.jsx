export default function OrganizationSwitcher({ organizations, currentOrgId, onOrgChange }) {
  if (!organizations.length) return null;

  return (
    <select
      className="org-switcher"
      value={currentOrgId || ""}
      onChange={(e) => onOrgChange(Number(e.target.value))}
      aria-label="Switch organization"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name} ({org.role})
        </option>
      ))}
    </select>
  );
}
