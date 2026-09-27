import { lazy, Suspense, useEffect, useRef } from "react";
import SearchPage from "./SearchPage";

// Three.js only loads for the homepage story, not the rest of the app.
const TrashStory = lazy(() => import("../story/TrashStory"));

// Scrolling this far fades the hero out, clearing the stage for the story. A fixed distance
// rather than a share of the window: on phones the window height changes as the browser's
// toolbars slide in and out, which would make the fade jump mid-scroll.
const HERO_FADE_DISTANCE = 260;

export default function HomePage() {
  const heroRef = useRef(null);

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
    <div className="home-page">
      <Suspense fallback={<div className="trash-story home-story-loading" />}>
        <TrashStory>
          <div className="home-hero" ref={heroRef}>
            <h1 className="home-hero-title">
              Confused?
              <br />
              So are they.
            </h1>
            <p className="home-hero-copy">
              Reviews happen once, are often gamed, and are usually too vague to act on. Businesses need
              your feedback on the first visit, the second, and the tenth. Big or small.
            </p>
            {/* Jumps past the story to the map (handled in animateStory.js). */}
            <button className="btn btn--primary" type="button" data-story-goto="end">
              Give feedback
            </button>
          </div>
        </TrashStory>
      </Suspense>
      <SearchPage home />
    </div>
  );
}
