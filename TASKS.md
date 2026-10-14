# Work plan

Do these in order and check each one off.

- [x] 1. Init repo: `package.json`, `tsconfig.json` (strict), `.gitignore`, scripts.
- [x] 2. `src/db.ts`: open database, create table and indexes, status constants, `TRANSITIONS`.
- [x] 3. Seed function (6 rows, 1 duplicate) and `npm run seed`. Auto-seed when empty.
- [x] 4. `src/app.ts`: the three endpoints with validation and error codes.
- [x] 5. `src/server.ts`: start the app, serve `public/`.
- [x] 6. API tests: list and filter, approve persists, final states return 409, bad status returns 400, missing id returns 404.
- [x] 7. UI: tabs with counts, table, detail panel, Approve/Reject, toast, loading/empty/error states.
- [x] 8. Manual check against the acceptance criteria in `PRD.md` section 7.
- [x] 9. README from `README_TEMPLATE.md`.
- [ ] 10. Push to GitHub.
