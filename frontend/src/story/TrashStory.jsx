import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { startTrashStory } from "./animateStory";
import "./TrashStory.css";

// Reviews burn, get binned, the talk turns sour, and the business closes - all
// driven by scrolling. The drawing and the scroll timeline live in animateStory.js.
// `children` are laid over the first screen of the story.
export default function TrashStory({ children }) {
  const rootRef = useRef(null);

  useEffect(() => startTrashStory(rootRef.current), []);

  return (
    <div className="trash-story" ref={rootRef}>
      <div id="story">
        <div
          id="scene"
          aria-label="An animated fire made entirely of ASCII characters. Good and bad Google- and Yelp-style review cards burn at its base, while words and asterisks drift up in the smoke. Scroll to lower the fire and reviews into a three-dimensional trash can."
        >
          <div id="composition">
            <div id="can-back" aria-hidden="true" />
            <div id="burning-window">
              <div id="burning">
                <canvas id="fire" width="840" height="780" aria-hidden="true" />
                <div className="reviews">
                  <article className="review google-card card-a" aria-label="Five-star Google-style review">
                    <div className="review-header">
                      <span className="avatar">A</span>
                      <span className="name">Alex M.<small>Local Guide · 24 reviews</small></span>
                      <span className="google-logo" aria-label="Google">G</span>
                    </div>
                    <div className="stars google-stars">★★★★★</div>
                    <strong>Absolutely loved it.</strong>
                    <p>Would come back any day.</p>
                  </article>
                  <article className="review yelp-card card-b" aria-label="One-star Yelp-style review">
                    <div className="review-header">
                      <span className="avatar">J</span>
                      <span className="name">Jamie R.<small>12 reviews</small></span>
                      <span className="yelp-logo">yelp<span>*</span></span>
                    </div>
                    <div className="stars yelp-stars">
                      <b>★</b><b className="empty">★</b><b className="empty">★</b><b className="empty">★</b><b className="empty">★</b>
                    </div>
                    <strong>Never again.</strong>
                    <p>Really disappointing service.</p>
                  </article>
                  <article className="review google-card card-c" aria-label="Two-star Google-style review">
                    <div className="review-header">
                      <span className="avatar">S</span>
                      <span className="name">Sam K.<small>8 reviews</small></span>
                      <span className="google-logo" aria-label="Google">G</span>
                    </div>
                    <div className="stars google-stars">★★<span>★★★</span></div>
                    <strong>Not worth the wait.</strong>
                    <p>Expected so much more.</p>
                  </article>
                  <article className="review yelp-card card-d" aria-label="Five-star Yelp-style review">
                    <div className="review-header">
                      <span className="avatar">M</span>
                      <span className="name">Morgan L.<small>32 reviews</small></span>
                      <span className="yelp-logo">yelp<span>*</span></span>
                    </div>
                    <div className="stars yelp-stars">
                      <b>★</b><b>★</b><b>★</b><b>★</b><b>★</b>
                    </div>
                    <strong>Such a great experience.</strong>
                    <p>Already told all my friends.</p>
                  </article>
                </div>
                <canvas id="embers" width="840" height="780" aria-hidden="true" />
              </div>
            </div>
            <div id="can-front" aria-hidden="true" />
          </div>

          <section id="conversation" aria-label="A conversation about the business" aria-hidden="true">
            <div className="chat-chapter" id="raving" aria-label="Customers rave about the business" aria-hidden="true">
              <article className="message incoming" data-at="0.385">
                <span className="speaker">Alex</span>
                <p>You have to try this place. Best service I’ve had in ages.</p>
              </article>
              <article className="message outgoing" data-at="0.445">
                <span className="speaker">Jamie</span>
                <p>We went yesterday. Absolutely loved it.</p>
              </article>
              <article className="message incoming" data-at="0.505">
                <span className="speaker">Alex</span>
                <p>Right? I’ve been telling everyone.</p>
              </article>
            </div>
            <div className="chat-chapter" id="returning" aria-label="The same customers return months later" aria-hidden="true">
              <div className="time-passed">A few months later</div>
              <article className="message incoming" data-at="0.65">
                <span className="speaker">Alex</span>
                <p>I went back… it’s really gone downhill.</p>
              </article>
              <article className="message outgoing" data-at="0.71">
                <span className="speaker">Jamie</span>
                <p>Same here. The service was awful this time.</p>
              </article>
              <article className="message incoming" data-at="0.77">
                <span className="speaker">Alex</span>
                <p>Such a shame. I won’t be going back.</p>
              </article>
            </div>
          </section>

          <div className="story-caption" id="can-caption" aria-hidden="true">
            <h2 className="story-caption-title">Reviews are great for hype. Businesses need more.</h2>
            <p className="story-caption-copy">
              But asking for a manager every visit, hunting for a feedback box, or emailing someone who
              may never read it? Nobody has time for that. So what you noticed ends up in the trash.
            </p>
          </div>

          {/* Placeholder copy for the chat and sign beats. */}
          <div className="story-caption" id="chat-caption" aria-hidden="true">
            <h2 className="story-caption-title">Nobody told the business.</h2>
            <p className="story-caption-copy">
              They told each other. By the time it shows up in the reviews, the regulars have already
              moved on.
            </p>
          </div>

          <div className="story-caption" id="sign-caption" aria-hidden="true">
            <h2 className="story-caption-title">Silence is expensive.</h2>
            <p className="story-caption-copy">
              Most places don&apos;t close overnight. They fade, one quiet customer at a time, while the fix
              was sitting in someone&apos;s head.
            </p>
          </div>

          {children}

          <div id="ending" aria-hidden="true">
            <div className="lease-sign" role="img" aria-label="A For Lease sign where the business used to be">
              <div className="lease-sign-posts" />
              <div className="lease-sign-board">
                <div className="lease-sign-header">FOR LEASE</div>
                <div className="lease-sign-body">
                  <span className="lease-sign-phone">225-555-0184</span>
                  <span className="lease-sign-space">Retail · 2,400 SF</span>
                </div>
              </div>
            </div>
          </div>

          <button className="story-continue" type="button" data-story-goto="next">
            Continue
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
