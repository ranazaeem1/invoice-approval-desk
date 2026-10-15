import Database from 'better-sqlite3';
import { seedDatabase } from './seed';

export type InvoiceStatus = 'processing' | 'needs_review' | 'approved' | 'rejected';

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'processing',
  'needs_review',
  'approved',
  'rejected',
];

export const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  processing: ['needs_review', 'approved', 'rejected'],
  needs_review: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

export interface Invoice {
  id: number;
  vendor: string;
  invoice_number: string;
  amount_cents: number;
  currency: string;
  issue_date: string;
  status: InvoiceStatus;
  duplicate_of: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function createDatabase(dbPath = process.env.DB_PATH || 'invoices.db') {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      issue_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'needs_review', 'approved', 'rejected')),
      duplicate_of INTEGER NULL REFERENCES invoices(id),
      note TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_vendor_number_amount ON invoices(vendor, invoice_number, amount_cents);
  `);

  seedDatabase(db, false);
  return db;
}

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath?: string) {
  if (dbPath) return createDatabase(dbPath);
  if (!dbInstance) dbInstance = createDatabase();
  return dbInstance;
}
