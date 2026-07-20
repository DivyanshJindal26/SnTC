import { getCollection, type CollectionEntry } from 'astro:content';

export type Event = CollectionEntry<'events'>;

/** Sub-events are excluded from top-level listings; drafts never ship. */
const visible = (e: Event) => import.meta.env.PROD ? !e.data.draft : true;

export const allEvents = async () => (await getCollection('events')).filter(visible);

/** Events with no parent — the fests and standalone items. */
export const topLevelEvents = async () =>
  (await allEvents()).filter((e) => !e.data.parent);

/** Direct children of an event, in chronological order. */
export const childrenOf = async (id: string) =>
  (await allEvents())
    .filter((e) => e.data.parent?.id === id)
    .sort(byStart);

export const byStart = (a: Event, b: Event) =>
  a.data.startDate.getTime() - b.data.startDate.getTime();

/** The moment an event is over. Falls back to end of its start day. */
export const endOf = (e: Event) => {
  const base = e.data.endDate ?? e.data.startDate;
  const d = new Date(base);
  if (e.data.endTime) {
    const [h, m] = e.data.endTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d;
};

export const isPast = (e: Event, now = new Date()) => endOf(e) < now;

/**
 * Upcoming ascending, past descending.
 *
 * Computed at build time, so a nightly rebuild is what keeps this honest —
 * see .github/workflows/deploy.yml.
 */
export const partitionByDate = (events: Event[], now = new Date()) => {
  const upcoming: Event[] = [];
  const past: Event[] = [];
  for (const e of events) (isPast(e, now) ? past : upcoming).push(e);
  upcoming.sort(byStart);
  past.sort((a, b) => byStart(b, a));
  return { upcoming, past };
};

/* ------------------------------------------------------------ formatting -- */

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const DAY_MONTH = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});

/** "14 Sep 2024" or "14–16 Sep 2024" */
export const formatDateRange = (start: Date, end?: Date) => {
  if (!end || start.getTime() === end.getTime()) return DATE.format(start);
  const sameYear = start.getFullYear() === end.getFullYear();
  return sameYear
    ? `${DAY_MONTH.format(start)} – ${DATE.format(end)}`
    : `${DATE.format(start)} – ${DATE.format(end)}`;
};

/** "10:00 – 12:00" from the stored 24-hour strings */
export const formatTimeRange = (start?: string, end?: string) =>
  !start ? null : end ? `${start} – ${end}` : start;
