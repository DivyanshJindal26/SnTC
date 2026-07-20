import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

/**
 * Every schema below uses `z.strictObject` on purpose.
 *
 * A misspelled key fails the build with the file and field named, instead of
 * silently dropping a person off the team page. That is the whole point: the
 * old site lost information quietly, this one refuses to.
 */

/* -------------------------------------------------------------------- groups
 * Clubs and cells share every field, so they share one collection and are told
 * apart by `kind`. One schema, one card component, one reference() target.
 */
const groups = defineCollection({
  loader: glob({ base: './src/content/groups', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.strictObject({
      name: z.string(),
      kind: z.enum(['club', 'cell']),
      /** Informal name, e.g. Programming Club goes by "KamandPrompt" */
      alias: z.string().optional(),
      tagline: z.string().max(140).optional(),
      /**
       * Optional: CG2D has no logo asset anywhere in the old site, and new
       * groups won't have one on day one. The card falls back to a
       * typographic mark built from the group's initials.
       */
      logo: image().optional(),
      website: z.url().optional(),
      instagram: z.url().optional(),
      email: z.email().optional(),
      /** Lower sorts first on the index and in the constellation */
      order: z.number().int().default(100),
      active: z.boolean().default(true),
    }),
});

/* ------------------------------------------------------------------- members
 * `role` is required. The old team page listed 17 names with no designations
 * at all, which is the single biggest content gap we are fixing.
 *
 * There is deliberately no rollNumber/studentId field. strictObject rejects
 * one if somebody adds it back.
 */
const members = defineCollection({
  loader: glob({ base: './src/data/members', pattern: '**/*.yaml' }),
  schema: ({ image }) =>
    z.strictObject({
      name: z.string(),
      role: z.string(),
      /** Sort order within a cohort. 0 sits at the top of the page. */
      roleRank: z.number().int().min(0).default(50),
      isLead: z.boolean().default(false),
      /** Academic year, e.g. "2025-26" */
      cohort: z.string().regex(/^\d{4}-\d{2}$/, 'cohort must look like "2025-26"'),
      groups: z.array(reference('groups')).default([]),
      /** Optional — the card falls back to an initials avatar */
      photo: image().optional(),
      linkedin: z.url().optional(),
      instagram: z.url().optional(),
      github: z.url().optional(),
      email: z.email().optional(),
      /** false moves them into the alumni section */
      active: z.boolean().default(true),
    }),
});

/* -------------------------------------------------------------------- events
 * Self-referential. Utkarsh is an event; its sub-events point at it via
 * `parent`. That makes next year's fest a folder of Markdown rather than a
 * new hand-written page, which is what utkarsh.html was.
 */
const events = defineCollection({
  loader: glob({ base: './src/content/events', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z
      .strictObject({
        title: z.string(),
        kind: z
          .enum([
            'fest',
            'competition',
            'workshop',
            'talk',
            'hackathon',
            'bootcamp',
            'other',
          ])
          .default('other'),
        parent: reference('events').optional(),
        summary: z.string().max(220),
        poster: image().optional(),
        /** "Offered by <club>" on the old event cards */
        host: reference('groups').optional(),
        /**
         * Required, and must carry a year. The old data said "14th September"
         * with no year, which makes an upcoming/past split impossible.
         */
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional(),
        startTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/, 'use 24-hour "HH:MM", e.g. "10:00"')
          .optional(),
        endTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/, 'use 24-hour "HH:MM", e.g. "12:00"')
          .optional(),
        /** Room or location code, e.g. "A11-1A" */
        venue: z.string().optional(),
        registerUrl: z.url().optional(),
        registrationClosesAt: z.coerce.date().optional(),
        /** For events with their own site, e.g. Xpecto */
        externalUrl: z.url().optional(),
        featured: z.boolean().default(false),
        draft: z.boolean().default(false),
      })
      .refine((d) => !d.endDate || d.endDate >= d.startDate, {
        message: 'endDate must be on or after startDate',
        path: ['endDate'],
      }),
});

/* ------------------------------------------------------------------ projects
 * Team entries are free text with an *optional* link to a member file, because
 * project rosters are mostly students who will never have one. Formula Bharat
 * alone lists ~25 people; forcing a reference would mean 25 stub files.
 */
const teamMember = z.strictObject({
  name: z.string(),
  role: z.string().optional(),
  member: reference('members').optional(),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.strictObject({
      title: z.string(),
      status: z.enum(['active', 'completed', 'archived']).default('active'),
      summary: z.string().max(220),
      image: image().optional(),
      /** Owning club, if any */
      group: reference('groups').optional(),
      lead: teamMember,
      coLead: teamMember.optional(),
      team: z.array(teamMember).default([]),
      /**
       * Plain integer rupees, e.g. 201000. The template formats it once with
       * Intl.NumberFormat('en-IN'); the old site had "INR 2,01,000" typed by
       * hand into the markup, formatted differently on different cards.
       */
      budgetINR: z.number().int().nonnegative().optional(),
      year: z.number().int().min(2015).max(2100).optional(),
      contactEmail: z.email().optional(),
      links: z.array(z.strictObject({ label: z.string(), url: z.url() })).default([]),
      draft: z.boolean().default(false),
    }),
});

/* ------------------------------------------------------------------ interiit
 * One file per Inter-IIT Tech Meet. Medal counts on the achievements page are
 * derived from this, not typed in — the old page hardcoded "3 gold / 4 silver
 * / 8 bronze" in the markup where it could drift from the listed medals.
 */
const medal = z.strictObject({
  type: z.enum(['gold', 'silver', 'bronze']),
  event: z.string(),
  /** Sponsoring org, e.g. "IGDC" */
  sponsor: z.string().optional(),
  /** e.g. "Mid Prep Event" */
  category: z.string().optional(),
  /** Names only. Never roll numbers — the old page published them. */
  members: z.array(z.string()).default([]),
});

const interiit = defineCollection({
  loader: glob({ base: './src/data/interiit', pattern: '*.yaml' }),
  schema: ({ image }) =>
    z.strictObject({
      /** 12 renders as "12.0" */
      edition: z.number().min(1).max(99),
      year: z.number().int(),
      host: z.string(),
      technicalSecretary: z.string(),
      contingentLeader: z.string(),
      deputyContingentLeader: z.string().optional(),
      overallRank: z.number().int().positive().optional(),
      medals: z.array(medal).default([]),
      highlights: z
        .array(z.strictObject({ title: z.string(), description: z.string() }))
        .default([]),
      photo: image().optional(),
      report: z.url().optional(),
    }),
});

/* --------------------------------------------------------------------- pages
 * Editable prose for otherwise-static pages, so copy changes don't require
 * touching a component.
 */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '*.md' }),
  schema: z.strictObject({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { groups, members, events, projects, interiit, pages };
