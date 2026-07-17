import { Fragment } from "react";

export default function BrandName({ className = "" }) {
  return (
    <span className={`brand-name${className ? ` ${className}` : ""}`} aria-label="five star">
      <span aria-hidden="true">five</span>
      <span className="brand-name-mark" aria-hidden="true" />
    </span>
  );
}

export function BrandedText({ children }) {
  const parts = String(children).split("five*");

  return parts.map((part, index) => (
    <Fragment key={`${part}-${index}`}>
      {index > 0 && <BrandName />}
      {part}
    </Fragment>
  ));
}
