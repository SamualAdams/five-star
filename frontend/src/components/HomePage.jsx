import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import BrandName from "./BrandName";
import SearchPage from "./SearchPage";

// Three.js only loads for the homepage story, not the rest of the app.
const TrashStory = lazy(() => import("../story/TrashStory"));

// Scrolling this far fades the hero out, clearing the stage for the story. A fixed distance
// rather than a share of the window: on phones the window height changes as the browser's
// toolbars slide in and out, which would make the fade jump mid-scroll.
const HERO_FADE_DISTANCE = 260;

export default function HomePage() {
  const heroRef = useRef(null);
  // Once someone starts using the search, the story is gone: the page is just search and
  // feedback, with nothing to scroll back up into.
  const [searching, setSearching] = useState(false);

  useLayoutEffect(() => {
    if (searching) window.scrollTo({ top: 0, behavior: "instant" });
  }, [searching]);

  useEffect(() => {
    let shown = null;
    function fadeHero() {
      const hero = heroRef.current;
      if (!hero) return;
      const faded = Math.min(1, Math.max(0, window.scrollY / HERO_FADE_DISTANCE));
      if (faded === shown) return;
      shown = faded;
      hero.style.opacity = 1 - faded;
      hero.style.transform = `translateY(${faded * -28}px)`;
      hero.style.visibility = faded >= 1 ? "hidden" : "visible";
    }
    window.addEventListener("scroll", fadeHero, { passive: true });
    fadeHero();
    return () => window.removeEventListener("scroll", fadeHero);
  }, []);

  return (
    <div className={`home-page${searching ? " home-page--searching" : ""}`}>
      {!searching && (
        <Suspense fallback={<div className="trash-story home-story-loading" />}>
          <TrashStory>
            <div className="home-hero" ref={heroRef}>
              <h1 className="home-hero-title">Tell businesses what you really think.</h1>
              <p className="home-hero-copy">
                <BrandName /> privately delivers your praise, problems, and ideas to the people who run
                the place, so they can act on them. No account needed.
              </p>
              {/* Jumps past the story to the map (handled in animateStory.js). */}
              <button className="btn btn--primary" type="button" data-story-goto="end">
                Give feedback
              </button>
            </div>
          </TrashStory>
        </Suspense>
      )}
      <SearchPage home onStart={() => setSearching(true)} />
    </div>
  );
}
