/**
 * Site-wide constants. Edit here, not in components — these strings appear in
 * the header, footer, and page metadata.
 */
export const site = {
  name: 'Science and Technology Council',
  shortName: 'SnTC',
  institute: 'IIT Mandi',
  url: 'https://sntc.iitmandi.co.in',
  description:
    'The technical society of IIT Mandi — eight clubs and four cells covering programming, robotics, astronomy, bioengineering, civil, mechanical, automotive engineering and entrepreneurship.',

  /** North campus sits in the Kamand valley; used by the elevation rail. */
  location: {
    campus: 'Kamand, Himachal Pradesh',
    altitudeMetres: 1075,
    lat: 31.7754,
    lon: 76.9861,
  },

  contact: {
    email: 'technical_secretary@students.iitmandi.ac.in',
    council: 'sntc@iitmandi.ac.in',
  },

  nav: [
    { label: 'Clubs', href: '/clubs/' },
    { label: 'Cells', href: '/cells/' },
    { label: 'Projects', href: '/projects/' },
    { label: 'Events', href: '/events/' },
    { label: 'Achievements', href: '/achievements/' },
    { label: 'Team', href: '/team/' },
  ],
} as const;

export type Site = typeof site;
