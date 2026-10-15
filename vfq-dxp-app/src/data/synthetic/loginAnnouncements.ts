// Company updates on the login page's hero panel (supplied login design). There is no announcements feed behind the
// sign-in screen, so these are fixed. The banner artwork - tag pill, headline and subline included - is the supplied
// image (public/brand/announcements); `alt` carries the same words for screen readers.
export interface LoginAnnouncement {
  id: string;
  image: string;
  alt: string;
  date: string;
  title: string;
  description: string;
}

export const LOGIN_ANNOUNCEMENTS: LoginAnnouncement[] = [
  {
    id: 'new-launch-5g',
    image: '/brand/announcements/new-launch-5g.webp',
    alt: 'New Launch. More Possibilities with 5G. Faster. Smarter. Closer.',
    date: '6 Oct 2026',
    title: 'Introducing Vodafone 5G+',
    description: 'Faster speeds. Greater possibilities.',
  },
  {
    id: 'special-offer',
    image: '/brand/announcements/special-offer.webp',
    alt: 'Special Offer. More for what you love. Exclusive offers for our customers.',
    date: '5 Oct 2026',
    title: 'More for what you love',
    description: 'Explore this season\'s customer offers.',
  },
  {
    id: 'company-notice',
    image: '/brand/announcements/company-notice.webp',
    alt: 'Company Notice. A Stronger Tomorrow. Together for a brighter future.',
    date: '7 Oct 2026',
    title: 'Our Next Chapter',
    description: 'A message from our CEO on our strategy and focus for the year ahead.',
  },
  {
    id: 'cyber-security',
    image: '/brand/announcements/cyber-security.webp',
    alt: 'Important Update. Together for a Safer Digital World. Be aware. Be secure. Stay protected.',
    date: '4 Oct 2026',
    title: 'Cyber Security Awareness',
    description: 'Tips and best practices to keep our customers and data safe.',
  },
  {
    id: 'new-benefit',
    image: '/brand/announcements/new-benefit.webp',
    alt: 'New Benefit. Better Connections Everyday. More value. More savings.',
    date: '3 Oct 2026',
    title: 'Employee Benefits Update',
    description: 'New partnerships and exclusive offers for Vodafone employees.',
  },
  {
    id: 'community',
    image: '/brand/announcements/community.webp',
    alt: 'Community. Connecting Communities. Making a positive difference together.',
    date: '2 Oct 2026',
    title: 'Our Community Initiatives',
    description: "Learn more about our recent activities and how we're giving back.",
  },
];
