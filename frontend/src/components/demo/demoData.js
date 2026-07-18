// Static data powering the homepage demo. Everything is fictional and
// hardcoded — the demo never touches the API.

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const DEMO_ORG = {
  name: "Magnolia Roux Coffee & Kitchen",
  city: "Baton Rouge, LA",
};

export const DEMO_SEARCH_RESULTS = [
  { id: "magnolia-roux", name: "Magnolia Roux Coffee & Kitchen" },
  { id: "magnolia-diner", name: "Magnolia Street Diner" },
  { id: "roux-rye", name: "Roux & Rye Bistro" },
];

export const DEMO_PREFILLED_REVIEW = {
  name: "Alex T.",
  text:
    "The cold brew is the best in Baton Rouge, hands down, and the staff always remembers my order. " +
    "Only gripe: the line on Saturday mornings gets really long — I've bailed a couple of times when I was in a hurry.",
};

export const DEMO_POLISHED_VARIANTS = {
  shorten:
    "Best cold brew in Baton Rouge and a staff that remembers your order. Just wish the Saturday morning line moved faster.",
  polish:
    "Magnolia Roux serves the best cold brew in Baton Rouge, and the staff's warmth makes every visit feel personal — they remember my order every time. My only suggestion would be extra help at the counter on Saturday mornings, when the line can get long.",
  simplify:
    "Great coffee and friendly staff. The line on Saturday mornings is too long, but everything else is perfect.",
};

// Matches the shape of Organization.review_links in the real app.
export const DEMO_REVIEW_LINKS = [
  { platform: "google", url: "#" },
  { platform: "yelp", url: "#" },
];

export const DEMO_FEEDBACK_ENTRIES = [
  { content: "Saturday line was out the door again — I love y'all but I can't spend 25 minutes waiting on a latte.", meta: "2 days ago · Anonymous" },
  { content: "Miss Renee at the counter is the reason I keep coming back. She remembers everybody.", meta: "3 days ago · Jasmine B." },
  { content: "Almond croissants were gone by 9:45 again. Please make more!", meta: "5 days ago · Anonymous" },
  { content: "Any chance of oat milk? Half my friends can't do dairy.", meta: "6 days ago · Anonymous" },
  { content: "Patio table by the door wobbles so bad I spilled my cortado.", meta: "1 week ago · Marcus D." },
  { content: "Wi-Fi kept dropping around lunch. Otherwise a perfect work spot.", meta: "1 week ago · Anonymous" },
  { content: "Love the punch card! Free 10th drink got me to switch from the chain up the road.", meta: "2 weeks ago · Anonymous" },
  { content: "Best gumbo-and-coffee combo in Baton Rouge. Don't change a thing.", meta: "2 weeks ago · Tara L." },
];

// 30 days of submission counts, oldest → newest. Sums to 23 (the digest's
// feedback_count), with today's count including the review submitted in the demo.
const DAILY_PATTERN = [
  0, 1, 1, 0, 2, 1, 1,
  0, 1, 0, 2, 1, 0, 1,
  1, 0, 1, 1, 0, 1, 0,
  1, 1, 0, 2, 0, 1, 0,
  1, 2,
];

export function demoStats(days = 30) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const idx = days - 1 - i;
    data.push({
      date: daysAgoIso(i),
      count: DAILY_PATTERN[idx % DAILY_PATTERN.length],
    });
  }
  return data;
}

export const DEMO_DIGEST = {
  status: "draft",
  period_start: daysAgoIso(29),
  period_end: daysAgoIso(0),
  feedback_count: 23,
  summary:
    "Customers love the coffee quality and the personal service — the cold brew and the counter staff come up again and again. " +
    "The clearest friction point is weekend morning wait times, followed by pastries selling out early and a handful of comfort issues " +
    "(wobbly patio tables, spotty Wi-Fi). Several regulars asked for oat milk. Overall sentiment is strongly positive, with the most " +
    "actionable requests concentrated on weekend capacity and morning stock.",
  insights: [
    "Cold brew and barista friendliness are your biggest strengths — mentioned in over half of submissions.",
    "Saturday and Sunday morning wait times are the #1 complaint, with several customers saying they've left without ordering.",
    "Pastries regularly sell out before 10am, disappointing late-morning regulars.",
    "Small comfort issues (wobbly patio tables, spotty Wi-Fi) are quietly hurting the work-from-café crowd.",
  ],
  immediate_actions: [
    "Add a second register or a dedicated mobile-order pickup lane on weekend mornings.",
    "Increase the Saturday pastry order, starting with the almond croissants that sell out first.",
    "Tighten or replace the wobbly patio tables — a five-minute fix customers keep noticing.",
  ],
  long_term_goals: [
    "Pilot oat milk and other alternative milks this quarter — the most requested menu addition.",
    "Upgrade the Wi-Fi to keep laptop customers around during slow weekday afternoons.",
    "Build a loyalty program around the regulars who already praise the punch card.",
  ],
};

export const DEMO_MEMBERS = [
  { email: "you@magnoliaroux.com", role: "admin", joined: "Jan 2026", isSelf: true },
  { email: "renee@magnoliaroux.com", role: "viewer", joined: "Feb 2026" },
  { email: "marcus@magnoliaroux.com", role: "viewer", joined: "Mar 2026" },
];

export const DEMO_STEPS = [
  {
    id: "intro",
    kicker: "The demo",
    caption: "A 60-second tour of five* — first as your customer, then as you.",
    url: "fivestar.fyi",
  },
  {
    id: "search",
    kicker: "Customer view",
    caption: "Your customer searches for your business — no account, no app.",
    url: "fivestar.fyi/search",
  },
  {
    id: "feedback",
    kicker: "Customer view",
    caption: "They write honest, private feedback. It goes to you — not to the internet.",
    url: "fivestar.fyi/feedback/magnolia-roux",
  },
  {
    id: "boost",
    kicker: "Customer view",
    caption:
      "Then five* nudges them to post publicly too — on the platforms you choose. It never pulls reviews away from Google or Yelp.",
    url: "fivestar.fyi/feedback/magnolia-roux",
  },
  {
    id: "flip",
    kicker: "Switching sides",
    caption: "That took your customer about 30 seconds. Now see what you get.",
    url: "fivestar.fyi/dashboard",
  },
  {
    id: "dashboard",
    kicker: "Owner view",
    caption: "Every submission lands on your private dashboard. One click turns them into a report.",
    url: "fivestar.fyi/dashboard",
  },
  {
    id: "formats",
    kicker: "Owner view",
    caption: "Same report, your format — bullets, an action plan, or a ready-to-send email.",
    url: "fivestar.fyi/dashboard",
  },
  {
    id: "share",
    kicker: "Owner view",
    caption: "Publish the report and your whole team sees the same priorities.",
    url: "fivestar.fyi/dashboard",
  },
];
