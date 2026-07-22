// Client-side auth configuration, injected into pages at build time.
// Values come from the project-root .env (see .env.example). These are
// public identifiers (safe to ship to the browser), not secrets — but they
// live in .env so deployments can swap Firebase projects without code edits.

function required(name: string): string {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Missing required env var ${name} — copy .env.example to .env and fill it in.`);
  return value;
}

export const FIREBASE_CONFIG = {
  apiKey: required('PUBLIC_FIREBASE_API_KEY'),
  authDomain: required('PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: required('PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: required('PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('PUBLIC_FIREBASE_SENDER_ID'),
  appId: required('PUBLIC_FIREBASE_APP_ID'),
};

export const GOOGLE_CLIENT_ID = required('PUBLIC_GOOGLE_CLIENT_ID');

export const ALLOWED_DOMAINS = required('PUBLIC_ALLOWED_DOMAINS')
  .split(',')
  .map((d: string) => d.trim())
  .filter(Boolean);

// Same pattern as a React + Express setup: in dev the client talks straight
// to the Express server (CORS allows localhost:4321); in the production
// build the API is same-origin, served by the same Express instance.
export const API_BASE = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
