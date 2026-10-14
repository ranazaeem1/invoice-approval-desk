# Schema and API reference

## Table: invoices
| Column | Type | Notes |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | |
| vendor | TEXT NOT NULL | |
| invoice_number | TEXT NOT NULL | |
| amount_cents | INTEGER NOT NULL, CHECK >= 0 | cents, not floats |
| currency | TEXT NOT NULL DEFAULT 'USD' | |
| issue_date | TEXT NOT NULL | ISO date |
| status | TEXT NOT NULL DEFAULT 'processing' | CHECK in the 4 statuses |
| duplicate_of | INTEGER NULL | FK to invoices(id) |
| note | TEXT NULL | |
| created_at | TEXT NOT NULL DEFAULT now | |
| updated_at | TEXT NOT NULL DEFAULT now | updated on every status change |

Indexes: `status`, and `(vendor, invoice_number, amount_cents)`.

## Seed data (6 rows)
| # | Vendor | Invoice no. | Amount | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Northwind Supplies | NW-1041 | 1,240.50 | processing | |
| 2 | Bluepeak Cloud | BP-2290 | 899.00 | processing | original |
| 3 | Harbor Legal LLP | HL-0378 | 4,500.00 | needs_review | amount above usual range |
| 4 | Bluepeak Cloud | BP-2290 | 899.00 | needs_review | duplicate_of = 2 |
| 5 | Greenleaf Catering | GC-557 | 320.75 | approved | |
| 6 | Apex Print Co | AP-9012 | 156.00 | rejected | no matching purchase order |

## Endpoints
### GET /api/invoices
Query: `status` (optional, comma-separated). Returns an array ordered by issue_date desc.
400 if a status is unknown.

### GET /api/invoices/:id
Returns one invoice. 404 if missing.

### PATCH /api/invoices/:id/status
Body: `{ "status": "approved", "note": "optional" }`
- 200 with the updated invoice.
- 400 invalid status or note type.
- 404 invoice not found.
- 409 transition not allowed (see PRD section 5).
