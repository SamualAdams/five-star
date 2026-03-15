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
            Free feedback tools for Baton Rouge businesses that want to keep getting better.
          </h1>
          <p className="marketing-copy">
            five* is a free service for Baton Rouge business owners who want honest customer
            feedback, clearer summaries, and practical ways to keep improving the businesses that
            make this city work.
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
            <span className="marketing-pill">Simple to share</span>
            <span className="marketing-pill">Built for improvement</span>
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
        <div className="digest-section__intro">
          <div className="section-header digest-section__header">
            <p className="section-kicker">What&apos;s a digest?</p>
            <h2 className="section-title">One clear team update built from many customer submissions.</h2>
            <p className="section-copy">
              A digest is how five* helps Baton Rouge business owners move from scattered feedback
              to aligned action. Instead of sorting through every submission one by one, you get a
              structured, actionable summary of what customers are seeing, what needs attention,
              and what your team should keep protecting.
            </p>
          </div>

          <aside className="digest-callout">
            <p className="digest-callout__label">Not raw comments</p>
            <p className="digest-callout__copy">
              Think of it as a working brief for your business: a digest you can review, modify,
              and share so your team is focused on the same customer experience priorities.
            </p>
          </aside>
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

        <div className="digest-alignment-band">
          <div>
            <p className="digest-alignment-band__label">Why it matters</p>
            <h3 className="digest-alignment-band__title">
              When the whole team sees the same digest, improvement gets more consistent.
            </h3>
          </div>
          <p className="digest-alignment-band__copy">
            Owners can use the digest to align staff around what customers want fixed, what should
            be protected, and how Baton Rouge businesses can keep raising the standard for customer
            experience.
          </p>
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
          <h2 className="section-title">Give your Baton Rouge customers a way to help you improve.</h2>
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
