import { useEffect, useId, useRef, useState } from "react";
import { ASTERISK_SRC, FIVE_STAR_LEVELS } from "../fiveStarLevels";

// A business's five* rating as five marks. Hover (or tap, on touch screens)
// explains what every level means, with this business's level highlighted.
export default function FiveStarRating({ stars = 0 }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const popoverId = useId();
  const level = FIVE_STAR_LEVELS[stars] ?? FIVE_STAR_LEVELS[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnOutsideTap(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideTap);
    return () => document.removeEventListener("pointerdown", closeOnOutsideTap);
  }, [isOpen]);

  return (
    <span className={`five-star-rating${isOpen ? " five-star-rating--open" : ""}`} ref={rootRef}>
      <button
        className="five-star-rating-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-describedby={popoverId}
        aria-label={`five* rating ${stars} of 5: ${level.title}`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => event.key === "Escape" && setIsOpen(false)}
      >
        <span className="five-star-rating-marks" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((mark) => (
            <img
              key={mark}
              src={ASTERISK_SRC}
              alt=""
              className={`five-star-rating-mark${mark <= stars ? " five-star-rating-mark--earned" : ""}`}
            />
          ))}
        </span>
      </button>

      <span className="five-star-rating-popover" id={popoverId} role="tooltip">
        <strong className="five-star-rating-popover-title">What five* ratings mean</strong>
        <span className="five-star-rating-levels">
          {FIVE_STAR_LEVELS.map((item) => (
            <span
              key={item.stars}
              className={`five-star-rating-level${item.stars === stars ? " five-star-rating-level--current" : ""}`}
            >
              <span className="five-star-rating-level-number">{item.stars}</span>
              <span>
                <strong>{item.title}</strong>
                {item.stars === stars && <em> · this business</em>}
                <br />
                {item.description}
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
