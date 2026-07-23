import { useRef, useState } from "react";
import { Ban, Inbox, Mail, Megaphone, MessageCircleQuestion } from "lucide-react";
import { Link } from "react-router-dom";
import BrandName, { BrandedText } from "./BrandName";
import HomeDemo from "./demo/HomeDemo";

const STEPS = [
  {
    number: "01",
    title: "Create your organization",
    description:
      "Set up your business in minutes and get a private page where customers can share feedback.",
  },
  {
    number: "02",
    title: "Customers find you and leave feedback",
    description:
      "Customers search or scan a QR code, then respond anonymously or identify themselves for follow up.",
  },
  {
    number: "03",
    title: "Turn feedback into next steps",
    description:
      "AI turns submissions into patterns, priorities, and practical actions your team can use.",
  },
  {
    number: "04",
    title: "Keep learning over time",
    description:
      "Unlike a one-time public review, customers can return as their experience changes, keeping your focus grounded in fresh feedback.",
  },
];

const SILENT_METHODS = [
  {
    icon: Inbox,
    title: "Find a feedback box",
  },
  {
    icon: MessageCircleQuestion,
    title: "Ask for the manager",
  },
  {
    icon: Mail,
    title: "Draft an email later",
  },
];

const COMPARISON_CHANNELS = [
  {
    id: "five",
    title: "Private feedback",
    brand: true,
  },
  {
    id: "review",
    title: "Public review",
    icon: Megaphone,
  },
  {
    id: "box",
    title: "Feedback box",
    icon: Inbox,
    avoided: true,
  },
  {
    id: "manager",
    title: "Ask a manager",
    icon: MessageCircleQuestion,
    avoided: true,
  },
  {
    id: "email",
    title: "Email later",
    icon: Mail,
    avoided: true,
  },
];

const COMPARISON_ROWS = [
  {
    label: "Customer effort",
    values: {
      five: "Low",
      review: "Medium",
      box: "High",
      manager: "High",
      email: "High",
    },
  },
  {
    label: "Timing",
    values: {
      five: "While it is fresh",
      review: "Often later",
      box: "Only if one is nearby",
      manager: "In the moment",
      email: "Usually later",
    },
  },
  {
    label: "Visibility",
    values: {
      five: "Private",
      review: "Public",
      box: "Private",
      manager: "Private",
      email: "Private",
    },
  },
  {
    label: "Customer identity",
    values: {
      five: "Anonymous or named",
      review: "Public profile",
      box: "Usually anonymous",
      manager: "Face-to-face",
      email: "Identified",
    },
  },
  {
    label: "Useful context",
    values: {
      five: "Prompted detail",
      review: "Score and comment",
      box: "Unstructured note",
      manager: "Live conversation",
      email: "Unstructured message",
    },
  },
  {
    label: "Ongoing learning",
    values: {
      five: "Patterns over time",
      review: "Isolated reviews",
      box: "Loose notes",
      manager: "One conversation",
      email: "Separate threads",
    },
  },
  {
    label: "Cost",
    values: {
      five: "2 cents per submission",
      review: "Free to receive",
      box: "Supplies and collection",
      manager: "Staff time",
      email: "Staff time and follow-up",
    },
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

const WHY_FIVE_PHOTOS = [
  {
    src: "/brand/five-star-mark.png",
    alt: "A subtle five-star mark displayed on a storefront window",
    objectPosition: "50% center",
  },
  {
    src: "/brand/five-star-counter-feedback.png",
    alt: "A framed feedback sign with a five-star mark displayed on a boutique counter",
    objectPosition: "61% center",
  },
  {
    src: "/brand/five-star-counter-card.png",
    alt: "A small five-star feedback card displayed on an office desk",
    objectPosition: "66% center",
  },
  {
    src: "/brand/five-star-gym-feedback.png",
    alt: "A five-star feedback sign displayed on a gym counter",
    objectPosition: "50% center",
  },
  {
    src: "/brand/five-star-water-cooler-qr.png",
    alt: "A horizontal QR feedback sign displayed above an office water cooler",
    objectPosition: "60% center",
  },
];

export default function MarketingPage() {
  const [whyFivePhotoIndex, setWhyFivePhotoIndex] = useState(0);
  const whyFiveSwipeRef = useRef(null);
  const whyFiveSuppressClickRef = useRef(false);

  function cycleWhyFivePhoto(direction = 1) {
    setWhyFivePhotoIndex(
      (index) => (index + direction + WHY_FIVE_PHOTOS.length) % WHY_FIVE_PHOTOS.length
    );
  }

  function handleWhyFivePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    whyFiveSwipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleWhyFivePointerUp(event) {
    const swipe = whyFiveSwipeRef.current;
    whyFiveSwipeRef.current = null;

    if (!swipe || swipe.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY);

    if (!isHorizontalSwipe) return;

    whyFiveSuppressClickRef.current = true;
    cycleWhyFivePhoto(deltaX < 0 ? 1 : -1);

    window.setTimeout(() => {
      whyFiveSuppressClickRef.current = false;
    }, 0);
  }

  function handleWhyFiveClick() {
    if (whyFiveSuppressClickRef.current) {
      whyFiveSuppressClickRef.current = false;
      return;
    }

    cycleWhyFivePhoto();
  }

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-panel marketing-panel--hero">
          <h1 className="marketing-title">
            Better feedback. Better business.
          </h1>
          <p className="marketing-copy">
            Your customers want you to succeed. They just need a private way to share what&apos;s
            working &mdash; and what isn&apos;t. <strong><BrandName /></strong> helps you see the patterns in
            that feedback, so you know where to focus.
          </p>

          <div className="marketing-actions">
            <Link className="btn btn--primary" to="/auth?mode=signup">
              Get started
            </Link>
            <a className="btn btn--outline" href="#demo">
              Try the interactive demo
            </a>
          </div>

        </div>

        <aside className="marketing-panel marketing-panel--aside">
          <p className="section-kicker">How it works</p>
          <h2 className="marketing-side-title">A simple loop from private feedback to clear next steps.</h2>
          <div className="marketing-overview-list">
            {STEPS.map((step) => (
              <div className="marketing-overview-item" key={step.number}>
                <p className="marketing-overview-number">{step.number}</p>
                <div>
                  <h3 className="marketing-overview-title">{step.title}</h3>
                  <p className="marketing-overview-copy"><BrandedText>{step.description}</BrandedText></p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="section-shell silent-majority-section">
        <div className="silent-majority-layout">
          <div className="constructive-chart" aria-label="Feedback channels ranked from useful to impractical and noisy">
            <div className="constructive-context-scale" aria-hidden="true">
              <span className="constructive-context-label">Useful</span>
              <span className="constructive-context-label constructive-context-label--middle">Impractical</span>
              <span className="constructive-context-track" />
              <span className="constructive-context-label">Noisy</span>
            </div>

            <div className="constructive-stack">
              <div className="constructive-tier constructive-tier--high">
                <img
                  className="constructive-tier-brand-mark"
                  src="/brand/five-star-asterisk.svg"
                  alt=""
                  aria-hidden="true"
                />
                <div>
                  <p className="constructive-tier-kicker">Private feedback</p>
                  <h3 className="constructive-tier-title">Specific, timely, useful.</h3>
                </div>
              </div>

              <div className="constructive-avoided">
                <p className="constructive-group-label">What customers usually avoid</p>
                <div className="silent-methods">
                  {SILENT_METHODS.map(({ icon: Icon, title }) => (
                    <div className="silent-method" key={title}>
                      <span className="silent-method-icon-wrap" aria-hidden="true">
                        <Icon className="silent-method-icon" strokeWidth={1.8} />
                        <Ban className="silent-method-ban" strokeWidth={1.8} />
                      </span>
                      <h3 className="silent-method-title">{title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              <div className="constructive-tier constructive-tier--low">
                <Megaphone className="constructive-tier-icon" strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <p className="constructive-tier-kicker">Public review</p>
                  <h3 className="constructive-tier-title">Visible, but often vague and too late.</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="section-header">
            <p className="section-kicker">The silent majority</p>
            <h2 className="section-title">Most customers who could help you never say a word.</h2>
            <p className="section-copy">
              Think about the customer who noticed something was off but didn&apos;t want to hurt your
              business. They weren&apos;t going to leave a bad review, and they weren&apos;t going to ask
              for the manager &mdash; that&apos;s just not how most people are wired. So they said nothing,
              left a polite tip, and walked out. You never found out, and you never saw them again.
            </p>
            <p className="section-copy" style={{marginTop: "0.75rem"}}>
              <BrandName /> gives them a quick, private way to say something while the experience
              is still fresh.
            </p>
          </div>
        </div>
      </section>

      <section className="section-shell problem-section">
        <div className="problem-layout">
          <div className="section-header">
            <p className="section-kicker">Sound familiar?</p>
            <h2 className="section-title">A one-star review gives you a score, not a clue.</h2>
            <p className="section-copy">
              The criticism is public, but the problem is vague. You&apos;re left replying carefully
              while everyone else sees the rating before they hear your side.
            </p>
            <p className="problem-thought">
              &ldquo;What happened? Is the next one already coming? Is this what every new customer
              will see first?&rdquo;
            </p>
          </div>

          <article className="public-review-mock" aria-label="Example one-star public review and business response">
            <header className="public-review-header">
              <span className="public-review-pin" aria-hidden="true">R</span>
              <div>
                <p className="public-review-platform">Local reviews</p>
                <p className="public-review-visibility">Public</p>
              </div>
            </header>

            <div className="public-review-post">
              <div className="public-review-author">
                <span className="public-review-avatar" aria-hidden="true">M</span>
                <div>
                  <p className="public-review-name">Morgan R.</p>
                  <p className="public-review-meta">1 review &middot; a week ago</p>
                </div>
              </div>

              <div className="public-review-stars" aria-label="1 out of 5 stars">
                <span className="public-review-star public-review-star--active" aria-hidden="true">&#9733;</span>
                <span className="public-review-star" aria-hidden="true">&#9733;</span>
                <span className="public-review-star" aria-hidden="true">&#9733;</span>
                <span className="public-review-star" aria-hidden="true">&#9733;</span>
                <span className="public-review-star" aria-hidden="true">&#9733;</span>
              </div>
              <p className="public-review-text">Disappointing. Not worth it. Won&apos;t be back.</p>
            </div>

            <div className="public-review-response">
              <p className="public-review-response-label">Response from the owner</p>
              <p>
                We&apos;re sorry to hear this. We&apos;d love to learn more about what happened so we
                can make it right.
              </p>
            </div>

            <p className="public-review-footnote">Visible to anyone searching for your business</p>
          </article>
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
            <p className="section-kicker">The listening mark</p>
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

          <figure
            className="why-five-figure"
            role="button"
            tabIndex={0}
            aria-label={`Placement photo ${whyFivePhotoIndex + 1} of ${WHY_FIVE_PHOTOS.length}. Swipe left or right, or activate, to change photo.`}
            onClick={handleWhyFiveClick}
            onPointerDown={handleWhyFivePointerDown}
            onPointerUp={handleWhyFivePointerUp}
            onPointerCancel={() => {
              whyFiveSwipeRef.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                cycleWhyFivePhoto();
              }
            }}
          >
            <div className="why-five-photo-stack">
              {WHY_FIVE_PHOTOS.map((photo, index) => {
                const position = (index - whyFivePhotoIndex + WHY_FIVE_PHOTOS.length) % WHY_FIVE_PHOTOS.length;

                return (
                  <img
                    key={photo.src}
                    className={`why-five-image why-five-image--position-${position}`}
                    src={photo.src}
                    alt={position === 0 ? photo.alt : ""}
                    aria-hidden={position === 0 ? undefined : "true"}
                    draggable="false"
                    style={{ objectPosition: photo.objectPosition }}
                  />
                );
              })}
            </div>
          </figure>
        </div>
      </section>

      <section className="section-shell why-fivestar-section">
        <div className="section-header">
          <p className="section-kicker">Why <BrandName /></p>
          <h2 className="section-title">An easier way to hear what customers really think.</h2>
          <p className="section-copy">
            A useful feedback channel has to work in the moment for customers and keep giving the
            business something clear to learn from. Here is how the common options compare.
          </p>
        </div>

        <div className="comparison-scroll">
          <table className="comparison-grid" aria-label="Comparison of customer feedback channels">
            <thead>
              <tr>
                <th className="comparison-criteria-head" scope="col">Criteria</th>
                {COMPARISON_CHANNELS.map((channel) => {
                  const Icon = channel.icon;

                  return (
                    <th
                      className={`comparison-channel-head${channel.brand ? " comparison-channel-head--featured" : ""}`}
                      key={channel.id}
                      scope="col"
                    >
                      <span className="comparison-channel-icon" aria-hidden="true">
                        {channel.brand ? (
                          <img src="/brand/five-star-asterisk.svg" alt="" />
                        ) : (
                          <>
                            <Icon strokeWidth={1.8} />
                            {channel.avoided ? <Ban className="comparison-channel-ban" strokeWidth={1.8} /> : null}
                          </>
                        )}
                      </span>
                      {channel.brand ? <span className="comparison-brand-name"><BrandName /></span> : null}
                      <span className="comparison-channel-title">{channel.title}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label}>
                  <th className="comparison-row-head" scope="row">{row.label}</th>
                  {COMPARISON_CHANNELS.map((channel) => (
                    <td
                      className={channel.brand ? "comparison-cell--featured" : undefined}
                      key={channel.id}
                    >
                      {row.values[channel.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
