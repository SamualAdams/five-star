import { Link } from "react-router-dom";

const STEPS = [
  {
    number: "01",
    title: "Create your organization",
    description:
      "Set up your organization in minutes and give your business a simple place to receive input.",
  },
  {
    number: "02",
    title: "Customers find you and leave feedback",
    description:
      "Customers search for your business or scan a QR code to submit feedback privately in seconds.",
  },
  {
    number: "03",
    title: "Turn feedback into next steps",
    description:
      "Gather customer input and turn it into a digest your team can use to improve customer experience.",
  },
];

const DIGEST_FLOW = [
  {
    number: "01",
    title: "Gather many submissions",
    description:
      "Customers share feedback over time, giving you more than a few isolated comments to react to.",
  },
  {
    number: "02",
    title: "Turn patterns into a digest",
    description:
      "five* converts those submissions into an insight-driven digest with a summary, clear themes, and practical next steps.",
  },
  {
    number: "03",
    title: "Review, refine, and share",
    description:
      "You can review and modify the digest, then share it with your team by link so everyone stays aligned on what to improve and uphold.",
  },
];

const VALUES = [
  {
    title: "You don't have time to chase reviews",
    description:
      "Most owners know something's off before a bad review hits — they just don't have a system to catch it. five* gives you one, for free.",
  },
  {
    title: "Customers don't always say it to your face",
    description:
      "Private feedback surfaces what people actually think. No awkward confrontations, no filtered responses — just honest input you can act on.",
  },
  {
    title: "Too many channels, not enough signal",
    description:
      "Google, Yelp, Facebook — it's scattered and noisy. We pull the signal out so you see what matters without the channel-hopping.",
  },
];

const BENEFITS = [
  "A shareable link customers use to submit feedback privately",
  "Anonymous submissions with optional contact details",
  "An actionable digest instead of a pile of raw comments",
];

export default function MarketingPage() {
  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-panel marketing-panel--hero">
          <p className="section-kicker">Built in Baton Rouge, for Baton Rouge</p>
          <h1 className="marketing-title">
            Better feedback for Baton Rouge.
          </h1>
          <p className="marketing-copy">
            Customers leave private, constructive feedback in seconds. We surface the critical
            issues and opportunities — so you're not muddling through reviews across every channel.
          </p>

          <div className="marketing-actions">
            <Link className="btn btn--primary" to="/auth?mode=signup">
              Get started free
            </Link>
            <Link className="btn btn--ghost" to="/auth?mode=login">
              Log in
            </Link>
          </div>

          <div className="marketing-pill-row">
            <span className="marketing-pill">Made for Baton Rouge</span>
            <span className="marketing-pill">Free for local businesses</span>
          </div>
        </div>

        <aside className="marketing-panel marketing-panel--aside">
          <p className="section-kicker">What owners get</p>
          <h2 className="marketing-side-title">A lightweight system that helps businesses listen well.</h2>
          <div className="marketing-benefit-list">
            {BENEFITS.map((benefit) => (
              <div className="marketing-benefit" key={benefit}>
                <span className="marketing-benefit-dot" />
                <p>{benefit}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="section-shell">
        <div className="section-header">
          <p className="section-kicker">How it works</p>
          <h2 className="section-title">A simple flow for listening, learning, and improving.</h2>
          <p className="section-copy">
            The goal is not to overwhelm Baton Rouge owners. It is to make customer feedback easier
            to collect and easier to use.
          </p>
        </div>

        <div className="marketing-grid">
          {STEPS.map((step) => (
            <article className="marketing-card marketing-card--step" key={step.number}>
              <p className="marketing-step-number">{step.number}</p>
              <h3 className="marketing-card-title">{step.title}</h3>
              <p className="marketing-card-copy">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-shell digest-section">
        <div className="section-header">
          <p className="section-kicker">What&apos;s a digest?</p>
          <h2 className="section-title">One clear team update built from many customer submissions.</h2>
          <p className="section-copy">
            five* collects private, constructive feedback — separate from public reviews.
            A digest turns those submissions into a structured summary of patterns, priorities,
            and next steps your team can act on.
          </p>
        </div>

        <div className="digest-flow-grid">
          {DIGEST_FLOW.map((item) => (
            <article className="marketing-card digest-flow-card" key={item.number}>
              <p className="marketing-step-number">{item.number}</p>
              <h3 className="marketing-card-title">{item.title}</h3>
              <p className="marketing-card-copy">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-shell">
        <div className="section-header">
          <p className="section-kicker">Why it exists</p>
          <h2 className="section-title">Built for the problems Baton Rouge owners actually have.</h2>
          <p className="section-copy">
            Not another dashboard to ignore. A simple system that works with how you already run
            your business.
          </p>
        </div>

        <div className="marketing-grid">
          {VALUES.map((value) => (
            <article className="marketing-card" key={value.title}>
              <h3 className="marketing-card-title">{value.title}</h3>
              <p className="marketing-card-copy">{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-cta-band">
        <div>
          <p className="section-kicker">Ready to start</p>
          <h2 className="section-title">Give your customers a way to help you improve.</h2>
          <p className="section-copy">
            Create a free account, share your feedback link, and start learning what your business
            needs next.
          </p>
        </div>

        <Link className="btn btn--primary" to="/auth?mode=signup">
          Get started free
        </Link>
      </section>
    </div>
  );
}
