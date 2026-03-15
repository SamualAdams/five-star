import { Link } from "react-router-dom";

const STEPS = [
  {
    number: "01",
    title: "Create your space",
    description:
      "Set up your organization in minutes and give your business a simple place to receive input.",
  },
  {
    number: "02",
    title: "Share your feedback link",
    description:
      "Invite customers to tell you what is working and what needs attention through one clean public page.",
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
    title: "Free community support",
    description:
      "five* exists to help local businesses improve and thrive without another subscription getting in the way.",
  },
  {
    title: "Honest customer input",
    description:
      "Customers get a respectful place to share feedback, which helps owners listen better and respond with clarity.",
  },
  {
    title: "Simple summaries",
    description:
      "Instead of sorting through scattered comments, you get a clearer picture of what to address first.",
  },
];

const BENEFITS = [
  "A public feedback link you can share anywhere",
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
            Share a simple feedback link with your customers. Get a clean, actionable digest
            instead of scattered comments.
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
            A digest is how five* helps you move from scattered feedback to aligned action.
            You get a structured summary of what customers are seeing and what needs attention.
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
          <h2 className="section-title">This is a Baton Rouge service, not a software pitch.</h2>
          <p className="section-copy">
            five* is here to help Baton Rouge businesses improve their customer experience and
            contribute to a healthier local business community overall.
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
