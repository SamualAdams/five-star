import { useRef, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Inbox,
  Mail,
  Megaphone,
  MessageCircleQuestion,
  MessagesSquare,
  Send,
} from "lucide-react";
import { Link } from "react-router-dom";
import BrandName, { BrandedText } from "./BrandName";
import LegalLinks from "./LegalLinks";

const STEPS = [
  {
    number: "01",
    title: "Tap Give feedback",
    description:
      "No account, download, or signup. Just open five* and start with the business you want to reach.",
  },
  {
    number: "02",
    title: "Find the right location",
    description:
      "Search by business name, street, or address. Choose the exact location so your message reaches the right people.",
  },
  {
    number: "03",
    title: "Share what's on your mind",
    description:
      "Big or small, praise or concern, first visit or tenth. Add your contact information if you want to, or stay anonymous.",
  },
  {
    number: "04",
    title: "We take it to them",
    description:
      "five* delivers your feedback privately, then helps the business understand what everyone is telling them.",
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

const DIGEST_FLOW = [
  {
    icon: Send,
    title: "We reach the business",
    description:
      "If they use five*, it reaches their private dashboard. If they do not, our team contacts them through an available channel.",
  },
  {
    icon: MessagesSquare,
    title: "We make the signal clear",
    description:
      "five* summarizes everyone’s feedback into recurring praise, concerns, priorities, and useful next steps.",
  },
  {
    icon: BadgeCheck,
    title: "We show who listens",
    description:
      "A listing says a business exists. five* shows which businesses actually listen and turn what they hear into action.",
  },
];

const QR_DISPLAY_PHOTOS = [
  {
    src: "/brand/five-star-mark.png",
    alt: "A subtle five* mark displayed on a storefront window",
    objectPosition: "50% center",
  },
  {
    src: "/brand/five-star-counter-feedback.png",
    alt: "A framed five* feedback QR sign displayed on a boutique counter",
    objectPosition: "61% center",
  },
  {
    src: "/brand/five-star-counter-card.png",
    alt: "A small five* feedback QR card displayed on an office desk",
    objectPosition: "66% center",
  },
  {
    src: "/brand/five-star-gym-feedback.png",
    alt: "A five* feedback QR sign displayed on a gym counter",
    objectPosition: "50% center",
  },
  {
    src: "/brand/five-star-water-cooler-qr.png",
    alt: "A five* QR feedback sign displayed above an office water cooler",
    objectPosition: "60% center",
  },
];

export default function MarketingPage() {
  const [qrPhotoIndex, setQrPhotoIndex] = useState(0);
  const qrSwipeRef = useRef(null);
  const qrSuppressClickRef = useRef(false);

  function cycleQrPhoto(direction = 1) {
    setQrPhotoIndex(
      (index) => (index + direction + QR_DISPLAY_PHOTOS.length) % QR_DISPLAY_PHOTOS.length
    );
  }

  function handleQrPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    qrSwipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleQrPointerUp(event) {
    const swipe = qrSwipeRef.current;
    qrSwipeRef.current = null;

    if (!swipe || swipe.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY);

    if (!isHorizontalSwipe) return;

    qrSuppressClickRef.current = true;
    cycleQrPhoto(deltaX < 0 ? 1 : -1);

    window.setTimeout(() => {
      qrSuppressClickRef.current = false;
    }, 0);
  }

  function handleQrClick() {
    if (qrSuppressClickRef.current) {
      qrSuppressClickRef.current = false;
      return;
    }

    cycleQrPhoto();
  }

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-panel marketing-panel--hero">
          <h1 className="marketing-title">
            <span className="marketing-title-word">Talk</span>{" "}
            <span className="marketing-title-word">to</span>{" "}
            <span className="marketing-title-word">us.</span>{" "}
            <span className="marketing-title-word">We&apos;ll</span>{" "}
            <span className="marketing-title-word">take</span>{" "}
            <span className="marketing-title-word">it</span>{" "}
            <span className="marketing-title-word">to</span>{" "}
            <span className="marketing-title-word">them.</span>
          </h1>
          <p className="marketing-copy">
            Tell <strong><BrandName /></strong> what you think about a business &mdash; praise,
            concern, observation, or idea. First visit or tenth, we&apos;ll deliver it to the right
            location and help the people running it understand what customers are saying. No
            account required.
          </p>

          <div className="marketing-actions">
            <Link className="btn btn--primary" to="/search">
              Give feedback
            </Link>
            <a className="btn btn--outline" href="#how-it-works">
              See how it works
            </a>
          </div>

        </div>

        <aside className="marketing-panel marketing-panel--aside" id="how-it-works">
          <p className="section-kicker">Stupid simple by design</p>
          <h2 className="marketing-side-title">You talk to us. We go to them.</h2>
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
                  <h3 className="constructive-tier-title">Too public and permanent for every thought.</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="section-header">
            <p className="section-kicker">Why five* exists</p>
            <h2 className="section-title">Feedback shouldn&apos;t require a confrontation.</h2>
            <p className="section-copy">
              You should not have to ask for a manager, put a business on blast, or wait until
              something goes seriously wrong. The employee in front of you may not know what to do,
              and a public review is too heavy for every passing thought. We understand that gap.
            </p>
            <p className="section-copy" style={{marginTop: "0.75rem"}}>
              Tell <BrandName /> directly. We identify the business and location, preserve what you
              said, and connect it to the people responsible for what happens next.
            </p>
            <p className="section-copy" style={{marginTop: "0.75rem"}}>
              Leave feedback after your third, fifth, or tenth visit. Every experience adds context,
              and the more you share, the clearer the picture becomes. If you care enough to say
              something, we believe the business should care enough to listen.
            </p>
          </div>
        </div>
      </section>

      <section className="section-shell digest-section">
        <div className="section-header">
          <p className="section-kicker">After you press send</p>
          <h2 className="section-title">We carry the message from here.</h2>
          <p className="section-copy">
            The business does not need a <BrandName /> account for you to speak. Partners receive
            feedback in their private dashboard. For everyone else, our team reaches out by email,
            phone, or another channel the business accepts. They may choose whether to respond, but
            we make every effort to ensure they know what customers are saying. Once they tell us
            how they will accept feedback, we keep using that channel for future messages.
          </p>
        </div>

        <div className="digest-flow-grid">
          {DIGEST_FLOW.map((item) => {
            const Icon = item.icon;

            return (
              <article className="marketing-card digest-outcome-card" key={item.title}>
                <span className="digest-outcome-icon" aria-hidden="true">
                  <Icon strokeWidth={1.8} />
                </span>
                <h3 className="marketing-card-title">{item.title}</h3>
                <p className="marketing-card-copy"><BrandedText>{item.description}</BrandedText></p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-shell why-five-section">
        <div className="why-five-layout">
          <div className="section-header">
            <p className="section-kicker">The modern feedback box</p>
            <h2 className="section-title">A QR code says this business is ready to listen.</h2>
            <p className="section-copy">
              Businesses can choose to display their unique <BrandName /> QR code in the window,
              at the counter, or anywhere customers might have something to say. Scan it and you
              can speak directly to that location without searching or creating an account.
            </p>
            <p className="section-copy" style={{marginTop: "0.75rem"}}>
              A physical feedback box asks you to write a note and hope someone checks it. This is
              the modern version: fast, private, and connected to a system that carries your voice
              to the people who can act on it.
            </p>
          </div>

          <figure
            className="why-five-figure"
            role="button"
            tabIndex={0}
            aria-label={`QR display photo ${qrPhotoIndex + 1} of ${QR_DISPLAY_PHOTOS.length}. Swipe left or right, or activate, to change photo.`}
            onClick={handleQrClick}
            onPointerDown={handleQrPointerDown}
            onPointerUp={handleQrPointerUp}
            onPointerCancel={() => {
              qrSwipeRef.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                cycleQrPhoto();
              }
            }}
          >
            <div className="why-five-photo-stack">
              {QR_DISPLAY_PHOTOS.map((photo, index) => {
                const position = (index - qrPhotoIndex + QR_DISPLAY_PHOTOS.length) % QR_DISPLAY_PHOTOS.length;

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

      <section className="section-shell why-five-section">
        <div className="section-header">
          <p className="section-kicker">Listening should be visible</p>
          <h2 className="section-title">You deserve to know whether anyone is paying attention.</h2>
          <p className="section-copy">
            Being in the five* catalog only means a business exists. We make it clear which
            businesses receive feedback, learn from what people are saying, and show that listening
            led somewhere. That is the social contract: people speak honestly, and businesses pay
            attention. A listing is automatic. Listening is earned.
          </p>
        </div>
      </section>

      <section className="marketing-cta-band">
        <div>
          <p className="section-kicker">We&apos;re with you</p>
          <h2 className="section-title">Whatever is on your mind, tell us.</h2>
          <p className="section-copy">
            Big or small. Good, bad, or somewhere in between. First visit or tenth. Find the
            business, choose the location, and say it simply. No account, and contact information is
            optional. We&apos;ll pass it along.
          </p>
        </div>

        <Link className="btn btn--primary" to="/search">
          Give feedback
        </Link>
      </section>

      <footer className="marketing-legal-footer">
        <p>&copy; 2026 five*</p>
        <LegalLinks />
      </footer>
    </div>
  );
}
