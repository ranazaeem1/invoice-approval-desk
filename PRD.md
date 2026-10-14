# PRD: Invoice approval desk

## 1. Summary
A small internal tool where a reviewer sees incoming invoices, spots duplicates, and approves or rejects each one. Decisions are saved in a database.

## 2. Users and goal
- **User:** an accounts-payable reviewer.
- **Goal:** clear the queue quickly without paying the same invoice twice.

## 3. Scope
**In scope**
- TypeScript REST API: list, get, update status.
- Web UI with three tabs, a detail view, and Approve/Reject.
- Persistent database with 4 to 6 seeded invoices, including exactly 1 duplicate.
- Short schema and status writeup in the README.

**Out of scope**
Authentication, invoice upload or creation, pagination, audit log, email notifications.

## 4. Functional requirements
| ID | Requirement |
| --- | --- |
| F1 | Seed 6 sample invoices on first start, 1 of them a duplicate of another (same vendor, invoice number, amount). |
| F2 | UI shows three tabs: **Processing**, **Needs review**, **Approved / rejected**. Each tab shows a count. |
| F3 | Clicking an invoice opens a detail view: vendor, invoice number, amount, issue date, status, note, last updated. |
| F4 | Duplicate invoices carry a visible "Duplicate" tag and a warning in the detail view that names the original invoice. |
| F5 | Approve and Reject buttons appear only for `processing` and `needs_review` invoices. |
| F6 | Approve/Reject calls the API and the new status is stored in the database. After a page reload the status is unchanged. |
| F7 | `GET /api/invoices` with optional `?status=a,b` filter. |
| F8 | `GET /api/invoices/:id`. |
| F9 | `PATCH /api/invoices/:id/status` with body `{ status, note? }`. |
| F10 | Approved and rejected are final. Changing them returns 409. |

## 5. Statuses and transitions
`processing`, `needs_review`, `approved`, `rejected`.

| From | Allowed to |
| --- | --- |
| processing | needs_review, approved, rejected |
| needs_review | approved, rejected |
| approved | none |
| rejected | none |

## 6. Non-functional requirements
- Runs with `npm install` and `npm run dev`. No external services.
- Amounts stored as integer cents.
- API errors are JSON: `{ "error": "message" }` with 400, 404, or 409.
- UI has loading, empty, and error states. Keyboard accessible. Works on mobile width and in dark mode.

## 7. Acceptance criteria
1. Fresh clone, `npm install`, `npm run dev`: the app opens with 6 invoices.
2. Needs review tab contains the duplicate, tagged as such.
3. Approving an invoice moves it to the Approved / rejected tab and survives a restart.
4. Trying to approve an already rejected invoice (via curl) returns 409.
5. `npm test` passes.

## 8. Deliverables
GitHub repo, a README with setup, API, schema, and status flow, and the reply email with the repo link and the audio recording.
