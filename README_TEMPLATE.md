# Invoice approval desk

One or two sentences: what this is and who it is for.

## Run it
Requires Node 18+.

```bash
npm install
npm run dev     # http://localhost:3000
npm run seed    # reset sample data
npm test
```

## UI
Describe the three tabs, the detail view, Approve/Reject, and the duplicate warning.

## API
| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/invoices?status=a,b | List, optional filter |
| GET | /api/invoices/:id | Get one |
| PATCH | /api/invoices/:id/status | Update status |

Error codes: 400, 404, 409.

## Schema
Paste the table from SCHEMA_AND_API.md.

## Statuses
Draw the transitions and say which are final.

## Design decisions
- Why this database.
- How duplicates are detected and why they are flagged rather than auto-rejected.
- Why money is stored in cents.

## Not included
What you left out and what you would do next.
