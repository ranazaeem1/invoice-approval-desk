# Agent instructions

Build the project described in `PRD.md`. The data model and endpoints are in `SCHEMA_AND_API.md`. The work plan is in `TASKS.md`.

## Stack
- Node 18+, TypeScript (strict mode).
- Express for the API, `better-sqlite3` for the database.
- Web UI served as static files by the same Express app (plain HTML, CSS, and JS is fine; React with Vite is also acceptable if you keep one command to run everything).
- Tests with `node:test` and `tsx`.

## Rules
- Keep it small. No auth, no ORM, no extra features beyond the PRD.
- All status rules live in one place (a `TRANSITIONS` map) and are enforced by the API, not only the UI.
- Validate input. Return JSON errors in the shape `{ "error": string }`.
- Store money as integer cents. Format it only in the UI.
- Seed automatically when the table is empty, and provide `npm run seed` to reset.
- UI: three tabs with counts, detail panel, Approve/Reject, loading/empty/error states, keyboard focus styles, mobile layout, dark mode.
- Do not commit `node_modules`, `*.db`, or `.env`.
- Scripts required: `dev`, `build`, `start`, `seed`, `test`.
- Write the README last, using `README_TEMPLATE.md`.
