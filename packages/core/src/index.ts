/**
 * @botready/core
 *
 * Shared and framework-free. This package imports nothing from Next.js,
 * Playwright or the database, and has no runtime dependencies at all, so the
 * web app, the worker and the tests can all use the same contracts and the same
 * arithmetic. If you find yourself installing something in here, the logic
 * probably belongs in the worker.
 */

export * from './types';
export * from './catalog';
export * from './scoring';
export * from './domain';
export * from './findings';
export * from './remedies';
