import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FilterMenu({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const activeOption = options.find((option) => option.value === value) || options[0];

  return (
    <div className="filter-menu" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={isOpen ? "filter-menu-trigger filter-menu-trigger--open" : "filter-menu-trigger"}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="filter-menu-trigger-label">{label}:</span>
        <span className="filter-menu-trigger-value">{activeOption?.label}</span>
        <ChevronDown aria-hidden="true" className="filter-menu-trigger-icon" size={16} strokeWidth={2.4} />
      </button>
      {isOpen && (
        <div className="filter-menu-panel" role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={option.value === value ? "filter-menu-option filter-menu-option--active" : "filter-menu-option"}
              key={option.value ?? "all"}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
