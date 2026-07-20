import { getCollection, type CollectionEntry } from 'astro:content';

export type Member = CollectionEntry<'members'>;

/** Leads first, then roleRank, then alphabetically. */
export const byRole = (a: Member, b: Member) =>
  Number(b.data.isLead) - Number(a.data.isLead) ||
  a.data.roleRank - b.data.roleRank ||
  a.data.name.localeCompare(b.data.name);

export const allMembers = async () => (await getCollection('members')).sort(byRole);

/** Cohorts newest first, e.g. "2025-26" before "2024-25". */
export const groupByCohort = async () => {
  const members = await allMembers();
  const map = new Map<string, Member[]>();
  for (const m of members) {
    const list = map.get(m.data.cohort) ?? [];
    list.push(m);
    map.set(m.data.cohort, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([cohort, list]) => ({ cohort, members: list }));
};

/** "Vaibhav Kesharwani" -> "VK". Used when a member has no photo. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
