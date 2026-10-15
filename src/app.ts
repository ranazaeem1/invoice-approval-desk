import express from 'express';
import Database from 'better-sqlite3';
import { getDatabase, Invoice, InvoiceStatus, INVOICE_STATUSES, TRANSITIONS } from './db';

function parseId(param: unknown) {
  const id = parseInt(Array.isArray(param) ? param[0] : (param as string), 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

export function createApp(db: Database.Database = getDatabase()) {
  const app = express();
  app.use(express.json());

  app.get('/api/invoices', (req, res) => {
    const { status } = req.query;

    if (status !== undefined) {
      if (typeof status !== 'string' || !status.trim()) {
        res.status(400).json({ error: 'Invalid status query parameter' });
        return;
      }

      const list = status.split(',').map((s) => s.trim());
      for (const s of list) {
        if (!INVOICE_STATUSES.includes(s as InvoiceStatus)) {
          res.status(400).json({ error: `Unknown status: '${s}'` });
          return;
        }
      }

      const placeholders = list.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT * FROM invoices WHERE status IN (${placeholders}) ORDER BY issue_date DESC, id DESC`
      ).all(...list);
      res.json(rows);
      return;
    }

    res.json(db.prepare('SELECT * FROM invoices ORDER BY issue_date DESC, id DESC').all());
  });

  app.post('/api/invoices', (req, res) => {
    const { vendor, invoice_number, amount_cents, issue_date } = req.body || {};

    if (
      !vendor || typeof vendor !== 'string' || !vendor.trim() ||
      !invoice_number || typeof invoice_number !== 'string' || !invoice_number.trim() ||
      typeof amount_cents !== 'number' || !Number.isInteger(amount_cents) || amount_cents < 0 ||
      !issue_date || typeof issue_date !== 'string' || !issue_date.trim() || Number.isNaN(Date.parse(issue_date))
    ) {
      res.status(400).json({ error: 'Invalid invoice data' });
      return;
    }

    const match = db.prepare(
      'SELECT id FROM invoices WHERE vendor = ? AND invoice_number = ? AND amount_cents = ? ORDER BY id ASC LIMIT 1'
    ).get(vendor.trim(), invoice_number.trim(), amount_cents) as { id: number } | undefined;

    const duplicate_of = match ? match.id : null;
    const status = duplicate_of ? 'needs_review' : 'processing';

    const info = db.prepare(`
      INSERT INTO invoices (vendor, invoice_number, amount_cents, issue_date, status, duplicate_of)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(vendor.trim(), invoice_number.trim(), amount_cents, issue_date.trim(), status, duplicate_of);

    const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  });

  app.get('/api/invoices/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!row) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json(row);
  });

  app.patch('/api/invoices/:id/status', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    const { status, note } = req.body || {};

    if (!status || typeof status !== 'string' || !INVOICE_STATUSES.includes(status as InvoiceStatus)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    if (note !== undefined && note !== null && typeof note !== 'string') {
      res.status(400).json({ error: 'Invalid note type' });
      return;
    }

    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Invoice | undefined;
    if (!row) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (!TRANSITIONS[row.status].includes(status as InvoiceStatus)) {
      res.status(409).json({ error: `Cannot transition status from '${row.status}' to '${status}'` });
      return;
    }

    const newNote = note !== undefined ? note : row.note;
    db.prepare(`
      UPDATE invoices
      SET status = ?, note = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, newNote, id);

    res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
