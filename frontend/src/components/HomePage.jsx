import { lazy, Suspense, useEffect, useRef } from "react";
import SearchPage from "./SearchPage";

// Three.js only loads for the homepage story, not the rest of the app.
const TrashStory = lazy(() => import("../story/TrashStory"));

// Scrolling this share of a screen fades the hero out, clearing the stage for the story.
const HERO_FADE_SCREENS = 0.3;

export default function HomePage() {
  const heroRef = useRef(null);

  useEffect(() => {
    function fadeHero() {
      const hero = heroRef.current;
      if (!hero) return;
      const faded = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * HERO_FADE_SCREENS)));
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
              So are we.
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
