import Database from 'better-sqlite3';
import { getDatabase } from './db';

const SEED_INVOICES = [
  { id: 1, vendor: 'Northwind Supplies', invoice_number: 'NW-1041', amount_cents: 124050, currency: 'USD', issue_date: '2026-10-10', status: 'processing', duplicate_of: null, note: null },
  { id: 2, vendor: 'Bluepeak Cloud', invoice_number: 'BP-2290', amount_cents: 89900, currency: 'USD', issue_date: '2026-10-08', status: 'processing', duplicate_of: null, note: null },
  { id: 3, vendor: 'Harbor Legal LLP', invoice_number: 'HL-0378', amount_cents: 450000, currency: 'USD', issue_date: '2026-10-05', status: 'needs_review', duplicate_of: null, note: 'amount above usual range' },
  { id: 4, vendor: 'Bluepeak Cloud', invoice_number: 'BP-2290', amount_cents: 89900, currency: 'USD', issue_date: '2026-10-09', status: 'needs_review', duplicate_of: 2, note: null },
  { id: 5, vendor: 'Greenleaf Catering', invoice_number: 'GC-557', amount_cents: 32075, currency: 'USD', issue_date: '2026-09-28', status: 'approved', duplicate_of: null, note: null },
  { id: 6, vendor: 'Apex Print Co', invoice_number: 'AP-9012', amount_cents: 15600, currency: 'USD', issue_date: '2026-09-25', status: 'rejected', duplicate_of: null, note: 'no matching purchase order' },
];

export function seedDatabase(db: Database.Database, reset = false) {
  const row = db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number };
  if (!reset && row?.count > 0) return;

  db.transaction(() => {
    if (reset) {
      db.prepare('DELETE FROM invoices').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'invoices'").run();
    }

    const insert = db.prepare(`
      INSERT INTO invoices (id, vendor, invoice_number, amount_cents, currency, issue_date, status, duplicate_of, note)
      VALUES (@id, @vendor, @invoice_number, @amount_cents, @currency, @issue_date, @status, @duplicate_of, @note)
    `);

    for (const inv of SEED_INVOICES) insert.run(inv);
  })();
}

if (require.main === module) {
  seedDatabase(getDatabase(), true);
  console.log('Database successfully seeded with 6 sample invoices.');
}
