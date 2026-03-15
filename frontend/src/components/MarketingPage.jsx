import { Link } from "react-router-dom";

const PAIN_POINTS = [
  {
    title: "You don't have time to chase reviews",
    description:
      "Most owners know something's off before a bad review hits — they just don't have a system to catch it early. five* gives you one, for free.",
  },
  {
    title: "Frustrated customers vent to you, not about you",
    description:
      "When customers know you're listening, they bring problems to you privately instead of venting on Google. five* gives them somewhere to go — before they go public.",
  },
  {
    title: "Too many channels, not enough signal",
    description:
      "Google, Yelp, Facebook — it's scattered and noisy. five* pulls the signal out so you see what matters without the channel-hopping.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create your organization",
    description:
      "Set up your business on five* in minutes. You get a simple page where customers can leave private feedback.",
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
      "five* turns submissions into a digest — a clear summary of patterns, priorities, and actions your team can use.",
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
      "Review and modify the digest, then share it with your team so everyone is aligned on what to improve and what to protect.",
  },
];

const BENEFITS = [
  "Customers submit feedback privately — not as a public review",
  "Anonymous or identified — customer's choice",
  "AI-powered digests that surface what actually matters",
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
            Your customers want you to succeed — they just need a way to tell you
            what&apos;s working and what isn&apos;t. five* gives them that channel,
            and gives you a clear summary of what to do next.
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
          <h2 className="marketing-side-title">A lightweight system that helps businesses hear what matters.</h2>
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
          <p className="section-kicker">Sound familiar?</p>
          <h2 className="section-title">The current system is broken.</h2>
          <p className="section-copy">
            Baton Rouge people want to spend money here — on food, dates, gatherings, and
            everything that makes this city work. But there&apos;s no real way for customers
            to work <em>with</em> businesses. Feedback either never happens, turns into gossip,
            or ends up as a bad review.
          </p>
        </div>

        <div className="marketing-grid">
          {PAIN_POINTS.map((point) => (
            <article className="marketing-card" key={point.title}>
              <h3 className="marketing-card-title">{point.title}</h3>
              <p className="marketing-card-copy">{point.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-shell">
        <div className="section-header">
          <p className="section-kicker">How it works</p>
          <h2 className="section-title">Simple for you. Simple for your customers.</h2>
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
          <h2 className="section-title">One clear summary built from many customer submissions.</h2>
          <p className="section-copy">
            A digest turns raw feedback into a structured summary — patterns, priorities, and
            next steps your team can act on. No more reading every comment one by one.
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
          <p className="section-kicker">Why five*</p>
          <h2 className="section-title">The asterisk means this business is listening.</h2>
          <p className="section-copy">
            The five* mark in an establishment is a symbol of unity between a business and its
            community. It tells every customer: <em>we care, and we want to hear from you.</em>
          </p>
          <p className="section-copy" style={{marginTop: "0.75rem"}}>
            We don&apos;t put our mark behind a business we wouldn&apos;t stand behind ourselves.
            five* exists to bring Baton Rouge customers and businesses closer together — because
            the best businesses are the ones that never stop listening.
          </p>
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
