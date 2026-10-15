# Invoice approval desk

A small web app for reviewing invoices. A reviewer can see what has come in, spot duplicates, and approve or reject each invoice. Built with TypeScript, Express and SQLite.

## Run it

Needs Node 18 or newer.

```bash
npm install
npm run dev     # http://localhost:3000
```

On the first start the app creates the database and adds 6 sample invoices, one of them a duplicate.

Other commands:

- `npm run seed` wipes the data and loads the 6 samples again
- `npm test` runs the tests
- `npm run build` then `npm start` runs the compiled version

## How it works

- There are three tabs: Processing, Needs review, and Approved / rejected. Each tab shows how many invoices it has.
- Click an invoice to see its details on the right.
- A duplicate has a red "Duplicate" tag, and its details show a warning with the original invoice, for example "Invoice #2 (BP-2290)".
- Approve and Reject save straight to the database. You can type a reviewer note first, but it is optional.
- Once an invoice is approved or rejected it is final, and the buttons are replaced by a short message.
- "Add invoice" opens a form for vendor, invoice number, amount and issue date. If an invoice with the same vendor, number and amount already exists, the new one is marked as a duplicate and goes to Needs review. Otherwise it goes to Processing.
- The page has loading, empty and error states.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/invoices?status=a,b` | List invoices, optionally filtered by status |
| GET | `/api/invoices/:id` | Get one invoice |
| POST | `/api/invoices` | Create an invoice: `vendor`, `invoice_number`, `amount_cents`, `issue_date` |
| PATCH | `/api/invoices/:id/status` | Change status: `{ "status": "approved", "note": "optional" }` |

Errors are returned as `{ "error": "message" }`:

- 400: bad input, unknown status, bad id or invalid JSON
- 404: invoice not found
- 409: that status change is not allowed

## Schema

Table `invoices`:

| Column | Type | Notes |
| --- | --- | --- |
| id | INTEGER | primary key |
| vendor | TEXT | required |
| invoice_number | TEXT | required |
| amount_cents | INTEGER | required, 0 or more |
| currency | TEXT | default `USD` |
| issue_date | TEXT | `YYYY-MM-DD` |
| status | TEXT | one of the four statuses below |
| duplicate_of | INTEGER | id of the original invoice, if this is a duplicate |
| note | TEXT | reviewer note |
| created_at, updated_at | TEXT | `updated_at` changes whenever the status changes |

There is an index on `status` for the tabs, and one on vendor, invoice number and amount for finding duplicates.

## Statuses

- `processing`: new, nobody has looked at it yet
- `needs_review`: a person should check it, for example a duplicate
- `approved` and `rejected`: final

Allowed changes:

- processing to needs_review, approved or rejected
- needs_review to approved or rejected
- approved and rejected cannot change

The API enforces these rules (the `TRANSITIONS` map in `src/db.ts`) and returns 409 for anything else. The database only checks that the status is one of the four valid values.

## Design decisions

- **SQLite:** nothing to install, so anyone can clone and run it. The schema would work on PostgreSQL with small changes.
- **Duplicates are flagged, not rejected:** a repeated invoice could be a real double charge or a corrected resubmission. A person should decide, so it goes to Needs review with a link to the original.
- **Money in cents:** whole numbers avoid the rounding errors you get with decimals. The form takes dollars and converts.
- **Rules in the API:** the buttons are hidden for final invoices, but the API checks as well, so the rules still hold if someone calls it directly.

## Not included

- Editing or deleting invoices
- Login and user roles
- Pagination
- A history of who made each decision
