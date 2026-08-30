# Implementation Plan

This project is a Midnight-based private payroll prototype. The current implementation already includes the shared types, API interface, mock implementation, worker app, employer app, and backend scaffolding. This plan keeps the work aligned to the repo rules and avoids unnecessary contract work until the required Midnight skills are available and the contract path is explicitly approved.

## Goals

- Keep the codebase aligned with the package ownership model in the task docs.
- Complete the remaining integration work in the API and app layers without inventing Compact syntax.
- Do not touch contract logic until the specified Midnight verification workflow is available.
- Ensure the repo builds cleanly with the configured workspace setup.

## Scope by package

### Shared and API

- Keep the interface stable and avoid widening the API without coordination.
- Repair dependency installation and workspace setup so the package builds reliably.
- Validate the mock API and integration files against the project TypeScript build.

### Worker app and employer app

- Keep the current React UI patterns and demo flows intact.
- Verify app builds and type checks after dependencies are installed.
- Use the mock API to demonstrate the underpayment failure flow and privacy model.

### Backend

- Keep the service read-only and non-custodial.
- Ensure NestJS dependencies are installed and the workspace structure is correct.
- Avoid importing Midnight SDK packages in backend code.

## Constraints

- No Compact work without the documented Midnight skill or verification path.
- No secret keys, salts, or private data in backend or server logs.
- Only the API package owns Midnight SDK imports.
- Root workspace changes should be done only when required for a shared toolchain or task dependency.

## Immediate next steps

1. Install the workspace dependencies from the repo root.
2. Re-run the TypeScript build and fix any remaining package-level issues.
3. Validate the mock API and app entry points.
4. Only then decide whether additional backend or API changes are required for the project to complete.
