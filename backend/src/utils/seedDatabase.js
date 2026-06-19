// Thin re-export pointing to the canonical seed script.
// The actual seeding logic lives in scripts/seed.js to keep it runnable
// as a standalone Node script without importing the full app.
export { default } from '../../scripts/seed.js';
