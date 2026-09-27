import { Link } from "react-router-dom";
import "./legal.css";

export default function LegalLinks({ className = "" }) {
  return (
    <nav className={`legal-links${className ? ` ${className}` : ""}`} aria-label="Legal">
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/data-deletion">Data deletion</Link>
    </nav>
  );
}
