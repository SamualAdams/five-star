// What each five* rating (0-5) means. five* staff set a business's rating; it
// starts at 0. Shown to customers on search and to businesses on their dashboard.
export const FIVE_STAR_LEVELS = [
  {
    stars: 0,
    title: "Not claimed yet",
    description: "No one from this business has engaged with five* yet.",
  },
  {
    stars: 1,
    title: "Receptive",
    description: "The business has engaged with five* and is open to your feedback.",
  },
  {
    stars: 2,
    title: "On five*",
    description: "The business is on five* and displays a five* mark or QR code at its location.",
  },
  {
    stars: 3,
    title: "Community-engaged",
    description: "The business interacts with its community through its five* page.",
  },
  {
    stars: 4,
    title: "Few complaints",
    description: "Fewer than 3 major complaints in the last 6 months.",
  },
  {
    stars: 5,
    title: "Loveable",
    description: "1 or fewer complaints in the last 6 months, and voted loveable by the community.",
  },
];

export const ASTERISK_SRC = `${import.meta.env.BASE_URL}brand/five-star-asterisk.svg`;
