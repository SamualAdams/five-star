import { Link } from "react-router-dom";
import BrandName, { BrandedText } from "./BrandName";
import HomeDemo from "./demo/HomeDemo";

const PAIN_POINTS = [
  {
    title: "You don't have time to chase reviews",
    description:
      "You often sense something is off before a bad review appears. five* gives you a simple way to catch it early.",
  },
  {
    title: "Frustrated customers vent to you, not about you",
    description:
      "When customers know you're listening, they bring problems to you privately instead of venting on public review sites.",
  },
  {
    title: "Stars don't tell you what to fix",
    description:
      "Ratings shape first impressions, but they rarely explain what to fix. five* gives you the feedback behind the score.",
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
      "five* turns submissions into usable data including patterns, priorities, and actions your team can use.",
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
    title: "Turn patterns into a report",
    description:
      "five* converts those submissions into an insight-driven report with a summary, clear themes, and practical next steps.",
  },
  {
    number: "03",
    title: "Review, refine, and share",
    description:
      "Review and modify the report, then share it with your team so everyone is aligned on what to improve and what to protect.",
  },
];

const BENEFITS = [
  "Customers submit feedback privately, not publicly",
  "Customers can remain anonymous or identify themselves for follow up discussion",
  "AI-powered to provide your business with what actually matters",
];

export default function MarketingPage() {
  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-panel marketing-panel--hero">
          <h1 className="marketing-title">
            Better feedback for businesses that listen.
          </h1>
          <p className="marketing-copy">
            Your customers want you to succeed. They just need a way to tell you
            what&apos;s working &mdash; and what isn&apos;t. <strong><BrandName /></strong> gives them that
            channel and gives you a clear summary of what to do next.
          </p>

          <div className="marketing-actions">
            <Link className="btn btn--primary" to="/auth?mode=signup">
              Get started
            </Link>
            <a className="btn btn--outline" href="#demo">
              See a live demo
            </a>
            <Link className="btn btn--ghost" to="/auth?mode=login">
              Log in
            </Link>
          </div>

        </div>

        <aside className="marketing-panel marketing-panel--aside">
          <p className="section-kicker">What you get</p>
          <h2 className="marketing-side-title">A lightweight system that helps you hear what matters.</h2>
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
          <p className="section-kicker">The silent majority</p>
          <h2 className="section-title">Most customers who could help you never say a word.</h2>
          <p className="section-copy">
            Think about the customer who noticed something was off but didn&apos;t want to hurt your business.
            They weren&apos;t going to leave a bad review, and they weren&apos;t going to ask for the manager
            &mdash; that&apos;s just not how most people are wired. So they said nothing, left a polite tip,
            and walked out &mdash; you never found out, and you never saw them again.
          </p>
          <p className="section-copy" style={{marginTop: "0.75rem"}}>
            <BrandName /> gives those customers somewhere to go &mdash; so the ones who want to help finally can, in private.
          </p>
        </div>
      </section>

      <section className="section-shell">
        <div className="section-header">
          <p className="section-kicker">Sound familiar?</p>
          <h2 className="section-title">The current system is broken.</h2>
          <p className="section-copy">
            People want to spend money at the places they love: food, dates, gatherings, and
            everything that makes their communities work. But there&apos;s no real way for customers
            to work <em>with</em> businesses. Feedback either never happens, turns into gossip,
            or ends up as a bad review.
          </p>
        </div>

        <div className="marketing-grid">
          {PAIN_POINTS.map((point) => (
            <article className="marketing-card" key={point.title}>
              <h3 className="marketing-card-title">{point.title}</h3>
              <p className="marketing-card-copy"><BrandedText>{point.description}</BrandedText></p>
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
              <p className="marketing-card-copy"><BrandedText>{step.description}</BrandedText></p>
            </article>
          ))}
        </div>
      </section>

      <HomeDemo />

      <section className="section-shell digest-section">
        <div className="section-header">
          <p className="section-kicker">The result</p>
          <h2 className="section-title">One clear report built from many customer submissions.</h2>
          <p className="section-copy">
            We call this a report. <BrandName /> turns raw feedback into a structured summary of patterns, priorities, and
            next steps your team can act on. No more reading every comment one by one.
          </p>
        </div>

        <div className="digest-flow-grid">
          {DIGEST_FLOW.map((item) => (
            <article className="marketing-card digest-flow-card" key={item.number}>
              <p className="marketing-step-number">{item.number}</p>
              <h3 className="marketing-card-title">{item.title}</h3>
              <p className="marketing-card-copy"><BrandedText>{item.description}</BrandedText></p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-shell why-five-section">
        <div className="why-five-layout">
          <div className="section-header">
            <p className="section-kicker">Why <BrandName /></p>
            <h2 className="section-title">The asterisk means this business is listening.</h2>
            <p className="section-copy">
              Displaying the <BrandName /> mark is always optional. When a partner wants it, its
              size, material, and placement are tailored to feel at home in the space. It quietly
              tells customers: <em>we welcome feedback.</em>
            </p>
            <p className="section-copy" style={{marginTop: "0.75rem"}}>
              That might be a discreet window mark, a small counter detail, or no physical mark at
              all. The partnership is about listening; the symbol is simply one way to show it.
            </p>
          </div>

          <figure className="why-five-figure">
            <img
              className="why-five-image"
              src="/brand/five-star-mark.png"
              alt="A subtle five-star mark displayed on a storefront window"
            />
          </figure>
        </div>
      </section>

      <section className="marketing-cta-band">
        <div>
          <p className="section-kicker">Ready to start</p>
          <h2 className="section-title">Give your customers a way to help you improve.</h2>
          <p className="section-copy">
            Create your account, share your feedback link, and start learning what your business
            needs next &mdash; just 2 cents per customer submission.
          </p>
        </div>

        <Link className="btn btn--primary" to="/auth?mode=signup">
          Get started
        </Link>
      </section>
    </div>
  );
}
