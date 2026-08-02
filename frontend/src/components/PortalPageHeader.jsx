export default function PortalPageHeader({
  eyebrow,
  title,
  description,
  actionHref = "",
  actionLabel = "",
}) {
  return (
    <header className="portal-page-heading">
      <div className="portal-page-heading-copy">
        {eyebrow && <p className="dashboard-kicker">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actionHref && actionLabel && (
        <a className="btn btn--ghost btn--sm portal-page-heading-action" href={actionHref} target="_blank" rel="noreferrer">
          <span>{actionLabel}</span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 13 13 7M8 7h5v5" />
          </svg>
        </a>
      )}
    </header>
  );
}
