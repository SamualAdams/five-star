import { useEffect, useRef, useState } from "react";
import { MousePointerClick, Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import BrandName from "../BrandName";
import DemoSearchScreen from "./DemoSearchScreen";
import DemoFeedbackScreen from "./DemoFeedbackScreen";
import DemoDashboardScreen from "./DemoDashboardScreen";
import DemoShareScreen from "./DemoShareScreen";
import { DEMO_ORG, DEMO_PREFILLED_REVIEW, DEMO_STEPS } from "./demoData";

const DASHBOARD_STEP = 5; // index of the owner-dashboard step
const PLAYBACK_DELAY_MS = 5000;

export default function HomeDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState(DEMO_PREFILLED_REVIEW.text);
  const [digestGenerated, setDigestGenerated] = useState(false);
  const [digestPublished, setDigestPublished] = useState(false);
  const [digestFormat, setDigestFormat] = useState("full");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState(false);
  const frameRef = useRef(null);
  const previousStepIndex = useRef(stepIndex);

  const step = DEMO_STEPS[stepIndex];
  const isLast = stepIndex === DEMO_STEPS.length - 1;

  // Screens vary a lot in height (e.g. the share screen starts short, then
  // grows once published). Re-anchor to the top of the frame on every step
  // change so a shrinking screen never leaves the viewport scrolled past
  // the part the user is meant to see.
  useEffect(() => {
    if (previousStepIndex.current === stepIndex) return;

    previousStepIndex.current = stepIndex;
    frameRef.current?.scrollIntoView({ block: "start" });
  }, [stepIndex]);

  useEffect(() => {
    if (!isPlaying || isLast) return undefined;

    const timeoutId = window.setTimeout(() => {
      const nextIndex = stepIndex + 1;

      if (nextIndex > DASHBOARD_STEP) setDigestGenerated(true);
      if (nextIndex === DEMO_STEPS.length - 1) {
        setDigestPublished(true);
        setIsPlaying(false);
        setPlaybackMode(false);
      }

      setStepIndex(nextIndex);
    }, PLAYBACK_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isLast, isPlaying, stepIndex]);

  function goTo(index) {
    setIsPlaying(false);
    setPlaybackMode(false);
    // Keep later steps consistent even if scripted actions were skipped
    if (index > DASHBOARD_STEP) setDigestGenerated(true);
    setStepIndex(Math.max(0, Math.min(index, DEMO_STEPS.length - 1)));
  }

  function restart() {
    setIsPlaying(false);
    setPlaybackMode(false);
    setStepIndex(0);
    setDraft(DEMO_PREFILLED_REVIEW.text);
    setDigestGenerated(false);
    setDigestPublished(false);
    setDigestFormat("full");
  }

  function startPlayback() {
    setStepIndex(1);
    setDraft(DEMO_PREFILLED_REVIEW.text);
    setDigestGenerated(false);
    setDigestPublished(false);
    setDigestFormat("full");
    setPlaybackMode(true);
    setIsPlaying(true);
  }

  function togglePlayback() {
    setIsPlaying((playing) => !playing);
  }

  function renderStep() {
    switch (step.id) {
      case "intro":
        return (
          <div className="demo-screen">
            <div className="demo-inter-card">
              <p className="section-kicker">Interactive demo</p>
              <h3 className="demo-inter-title">See <BrandName /> from both sides.</h3>
              <p className="demo-inter-copy">
                First you&apos;ll play the customer leaving feedback for{" "}
                <strong>{DEMO_ORG.name}</strong>, a (fictional) café in {DEMO_ORG.city}. Then
                you&apos;ll switch sides and see exactly what the owner gets.
              </p>
              <div className="demo-start-actions">
                <button type="button" className="btn btn--primary" onClick={() => goTo(1)}>
                  Start interactive demo →
                </button>
                <button type="button" className="demo-autoplay-start" onClick={startPlayback}>
                  <Play size={15} fill="currentColor" aria-hidden="true" />
                  Play automatically
                </button>
              </div>
            </div>
          </div>
        );
      case "search":
        return <DemoSearchScreen onSelect={() => goTo(2)} />;
      case "feedback":
        return (
          <DemoFeedbackScreen
            stage="form"
            onSubmitted={(content) => {
              setDraft(content);
              goTo(3);
            }}
          />
        );
      case "boost":
        return <DemoFeedbackScreen stage="boost" draft={draft} onDraftChange={setDraft} />;
      case "flip":
        return (
          <div className="demo-screen">
            <div className="demo-inter-card">
              <p className="section-kicker">Switching sides</p>
              <h3 className="demo-inter-title">That took your customer about 30 seconds.</h3>
              <p className="demo-inter-copy">
                No account, no public post, no awkward conversation. Now see what all that
                honest feedback turns into for <strong>you</strong>, the owner.
              </p>
              <button type="button" className="btn btn--primary" onClick={() => goTo(5)}>
                View the owner dashboard →
              </button>
            </div>
          </div>
        );
      case "dashboard":
        return (
          <DemoDashboardScreen
            digestGenerated={digestGenerated}
            onGenerated={() => setDigestGenerated(true)}
            format={digestFormat}
            onFormatChange={setDigestFormat}
          />
        );
      case "formats":
        return (
          <DemoDashboardScreen
            focus="formats"
            digestGenerated
            onGenerated={() => setDigestGenerated(true)}
            format={digestFormat}
            onFormatChange={setDigestFormat}
          />
        );
      case "share":
        return (
          <DemoShareScreen
            published={digestPublished}
            onPublish={() => setDigestPublished(true)}
          />
        );
      default:
        return null;
    }
  }

  return (
    <section className="home-demo" id="demo">
      <div className="section-header">
        <p className="section-kicker">Try it</p>
        <h2 className="section-title">See the whole loop in 60 seconds.</h2>
      </div>

      <div className="home-demo-experience" ref={frameRef}>
        {stepIndex > 0 && (
          <>
            <div className="demo-guidance">
              <div className="demo-guidance-content">
                <p className="demo-guidance-label">
                  {playbackMode ? (
                    <Play size={14} fill="currentColor" aria-hidden="true" />
                  ) : (
                    <MousePointerClick size={14} aria-hidden="true" />
                  )}
                  {playbackMode
                    ? isPlaying
                      ? "Playing automatically"
                      : "Autoplay paused"
                    : "Demo guide"}
                </p>
                <p className="demo-guidance-copy" aria-live="polite">
                  {playbackMode || (step.id === "share" && digestPublished)
                    ? step.caption
                    : step.guidance}
                </p>
              </div>
              {playbackMode && (
                <button
                  type="button"
                  className="demo-playback-control"
                  onClick={togglePlayback}
                  aria-label={isPlaying ? "Pause autoplay" : "Resume autoplay"}
                >
                  {isPlaying ? (
                    <Pause size={15} aria-hidden="true" />
                  ) : (
                    <Play size={15} fill="currentColor" aria-hidden="true" />
                  )}
                  {isPlaying ? "Pause" : "Resume"}
                </button>
              )}
            </div>

            <div className="home-demo-controls">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => goTo(stepIndex - 1)}
              >
                ← Back
              </button>

              <span className="demo-progress" aria-live="polite">
                Step {stepIndex} of {DEMO_STEPS.length - 1}
              </span>

              <div className="demo-controls-right">
                <button type="button" className="demo-restart" onClick={restart}>
                  Restart
                </button>
                {isLast ? (
                  <Link className="btn btn--primary btn--sm" to="/auth?mode=signup">
                    Get started
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => goTo(stepIndex + 1)}
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="home-demo-frame">
          <div className="home-demo-chrome">
            <span className="home-demo-chrome-dots" aria-hidden="true">
              <span className="home-demo-chrome-dot" />
              <span className="home-demo-chrome-dot" />
              <span className="home-demo-chrome-dot" />
            </span>
            <span className="home-demo-url">{step.url}</span>
          </div>
          <div
            className={`home-demo-stage ${stepIndex === DASHBOARD_STEP ? "home-demo-stage--flip" : ""}`}
            key={stepIndex}
          >
            {renderStep()}
          </div>
        </div>
      </div>

    </section>
  );
}
