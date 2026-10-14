# Invoice approval desk

A lightweight internal web application for accounts-payable reviewers to inspect incoming invoices, detect duplicate billing, and execute final approval or rejection decisions.

## Run it
Requires Node 18+.

```bash
npm install
npm run dev     # http://localhost:3000
npm run seed    # reset sample data
npm test
```

Additional scripts:
- `npm run build` — Compiles TypeScript to `dist/`.
- `npm start` — Runs the compiled production server.

## UI
- **Three queue tabs with live counts:**
  - **Processing:** Invoices ready for initial review.
  - **Needs review:** Invoices flagged for attention (e.g., duplicate submissions or amounts exceeding normal thresholds).
  - **Approved / rejected:** Closed items where a final decision has been recorded.
- **Master list & detail view:** Selecting any invoice opens a comprehensive detail view displaying vendor name, invoice number, formatted currency amount, issue date, status badge, duplicate relationship, reviewer note, and last updated timestamp.
- **Duplicate warning:** Invoices flagged as duplicates display a prominent badge in the list and an alert banner in the detail panel that explicitly names the original invoice (vendor, invoice number, and amount).
- **Approve and Reject controls:**
  - Active only for invoices in `processing` and `needs_review` statuses.
  - Reviewers can optionally append context notes before submitting decisions.
  - Once approved or rejected, action buttons are replaced by a permanent final decision badge.
- **User experience & accessibility:**
  - Dedicated loading, empty, and error states.
  - Non-intrusive toast notifications on successful actions or errors.
  - Seamless dark mode / light mode toggle with `localStorage` persistence and OS preference detection.
  - Full keyboard navigation and accessible focus indicators.

## API
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/invoices?status=a,b` | List invoices ordered by `issue_date` descending; optional comma-separated status filter. |
| `GET` | `/api/invoices/:id` | Retrieve a single invoice by ID. |
| `PATCH` | `/api/invoices/:id/status` | Update invoice status (`{ "status": "approved", "note": "optional" }`). |

### Error codes
- `400 Bad Request`: Invalid status filter, invalid request payload, malformed ID, or invalid note data type.
- `404 Not Found`: Requested invoice ID does not exist.
- `409 Conflict`: Attempted state transition is disallowed by transition rules (e.g., modifying an already approved or rejected invoice).

## Schema
### Table: `invoices`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK AUTOINCREMENT | Unique invoice identifier |
| `vendor` | TEXT NOT NULL | Vendor name |
| `invoice_number` | TEXT NOT NULL | Vendor invoice identifier |
| `amount_cents` | INTEGER NOT NULL, CHECK >= 0 | Amount in cents (no floats) |
| `currency` | TEXT NOT NULL DEFAULT 'USD' | Currency code |
| `issue_date` | TEXT NOT NULL | ISO date string (YYYY-MM-DD) |
| `status` | TEXT NOT NULL DEFAULT 'processing' | CHECK constraint in the 4 allowed statuses |
| `duplicate_of` | INTEGER NULL | Foreign key referencing `invoices(id)` |
| `note` | TEXT NULL | Reviewer notes or remarks |
| `created_at` | TEXT NOT NULL DEFAULT now | Timestamp recorded at creation |
| `updated_at` | TEXT NOT NULL DEFAULT now | Timestamp updated on every status modification |

Indexes:
- `idx_invoices_status` on `status`
- `idx_invoices_vendor_number_amount` on `(vendor, invoice_number, amount_cents)`

## Statuses
```
             ┌─────────────────────────────┐
             │         processing          │
             └──────────────┬──────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      ┌─────────────────┐       ┌─────────────────┐
      │  needs_review   │       │    approved     │ (final)
      └────────┬────────┘       └─────────────────┘
               │                         ▲
               ├─────────────────────────┘
               ▼
      ┌─────────────────┐
      │    rejected     │ (final)
      └─────────────────┘
```

- Allowed transitions:
  - `processing` ➔ `needs_review`, `approved`, `rejected`
  - `needs_review` ➔ `approved`, `rejected`
  - `approved` ➔ *None (terminal)*
  - `rejected` ➔ *None (terminal)*
- Enforced at both the REST API layer and database constraints. Any illegal transition attempt yields an immediate `409 Conflict`.

## Design decisions
- **Why SQLite (`better-sqlite3`):** It provides zero-configuration, synchronous, high-throughput persistence without requiring external database services or network overhead. With foreign keys and WAL mode enabled, it guarantees ACID compliance and immediate read-your-writes consistency.
- **How duplicates are detected and why flagged rather than auto-rejected:** A duplicate is identified when an incoming invoice shares the same vendor, invoice number, and amount cents as an existing record. Flagging invoices to `needs_review` rather than auto-rejecting preserves reviewer discretion. Legitimate resubmissions (such as corrected tax calculations or vendor re-issuances) can be examined with full context rather than silently dropped.
- **Why money is stored in cents:** IEEE 754 floating-point representations are prone to rounding errors (e.g. `0.1 + 0.2 !== 0.3`). Storing currency as non-negative integer cents eliminates fractional rounding bugs and ensures exact arithmetic across storage, validation, and presentation.

## Not included
- User authentication and role-based access control (RBAC).
- File upload handling and PDF invoice OCR extraction.
- Batch multi-select approval/rejection operations.
- Historical audit event ledger table.
- Webhook notifications and automated vendor email alerts.
