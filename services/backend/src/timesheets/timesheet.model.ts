/**
 * Timesheet domain model.
 *
 * Re-exports from contracts/index.ts for co-location with the service.
 * The canonical type definitions live in contracts/ so frontends can
 * consume them via `import type`.
 */
export type { Timesheet, TimesheetStatus } from '../contracts/index.js';
