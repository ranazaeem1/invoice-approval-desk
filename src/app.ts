import express, { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import { getDatabase, Invoice, InvoiceStatus, INVOICE_STATUSES, TRANSITIONS } from './db';

export function createApp(db: Database.Database = getDatabase()): express.Application {
  const app = express();

  app.use(express.json());

  // GET /api/invoices
  // Query: status (optional, comma-separated). Returns array ordered by issue_date desc.
  app.get('/api/invoices', (req: Request, res: Response) => {
    const statusQuery = req.query.status;

    if (statusQuery !== undefined) {
      if (typeof statusQuery !== 'string' || statusQuery.trim() === '') {
        res.status(400).json({ error: 'Invalid status query parameter' });
        return;
      }

      const statuses = statusQuery.split(',').map((s) => s.trim());
      for (const s of statuses) {
        if (!INVOICE_STATUSES.includes(s as InvoiceStatus)) {
          res.status(400).json({ error: `Unknown status: '${s}'` });
          return;
        }
      }

      const placeholders = statuses.map(() => '?').join(',');
      const stmt = db.prepare(
        `SELECT * FROM invoices WHERE status IN (${placeholders}) ORDER BY issue_date DESC, id DESC`
      );
      const rows = stmt.all(...statuses) as Invoice[];
      res.json(rows);
      return;
    }

    const stmt = db.prepare('SELECT * FROM invoices ORDER BY issue_date DESC, id DESC');
    const rows = stmt.all() as Invoice[];
    res.json(rows);
  });

  // GET /api/invoices/:id
  // Returns one invoice. 404 if missing.
  app.get('/api/invoices/:id', (req: Request, res: Response) => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id) || id < 1) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Invoice | undefined;
    if (!row) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json(row);
  });

  // PATCH /api/invoices/:id/status
  // Body: { "status": "approved", "note": "optional" }
  app.patch('/api/invoices/:id/status', (req: Request, res: Response) => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id) || id < 1) {
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

    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Invoice | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const allowedTransitions = TRANSITIONS[existing.status];
    if (!allowedTransitions.includes(status as InvoiceStatus)) {
      res.status(409).json({
        error: `Cannot transition status from '${existing.status}' to '${status}'`,
      });
      return;
    }

    const newNote = note !== undefined ? note : existing.note;
    db.prepare(`
      UPDATE invoices
      SET status = ?, note = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, newNote, id);

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Invoice;
    res.json(updated);
  });

  // Fallback 404 for unknown api routes
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
