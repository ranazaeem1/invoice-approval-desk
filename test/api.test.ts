import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';
import { createDatabase } from '../src/db';
import { seedDatabase } from '../src/seed';

describe('Invoice Approval Desk API', () => {
  let db: Database.Database;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    db = createDatabase(':memory:');
    seedDatabase(db, true);
    const app = createApp(db);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  });

  beforeEach(() => {
    // Reset seed data before each test for test isolation
    seedDatabase(db, true);
  });

  describe('GET /api/invoices', () => {
    it('returns all 6 seeded invoices ordered by issue_date desc', async () => {
      const res = await fetch(`${baseUrl}/api/invoices`);
      assert.equal(res.status, 200);
      const invoices = (await res.json()) as any[];
      assert.equal(invoices.length, 6);

      // Verify descending order of issue_date
      for (let i = 0; i < invoices.length - 1; i++) {
        assert.ok(invoices[i].issue_date >= invoices[i + 1].issue_date);
      }

      // Check duplicate tag present on seeded duplicate
      const duplicateInvoice = invoices.find((inv) => inv.id === 4);
      assert.ok(duplicateInvoice);
      assert.equal(duplicateInvoice.duplicate_of, 2);
    });

    it('filters invoices by a single status', async () => {
      const res = await fetch(`${baseUrl}/api/invoices?status=processing`);
      assert.equal(res.status, 200);
      const invoices = (await res.json()) as any[];
      assert.equal(invoices.length, 2);
      assert.ok(invoices.every((inv) => inv.status === 'processing'));
    });

    it('filters invoices by multiple comma-separated statuses', async () => {
      const res = await fetch(`${baseUrl}/api/invoices?status=approved,rejected`);
      assert.equal(res.status, 200);
      const invoices = (await res.json()) as any[];
      assert.equal(invoices.length, 2);
      const statuses = invoices.map((inv) => inv.status);
      assert.ok(statuses.includes('approved'));
      assert.ok(statuses.includes('rejected'));
    });

    it('returns 400 if status filter contains an unknown status', async () => {
      const res = await fetch(`${baseUrl}/api/invoices?status=unknown_status`);
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: string };
      assert.ok(body.error);
      assert.match(body.error, /unknown status/i);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('returns a single invoice by id', async () => {
      const res = await fetch(`${baseUrl}/api/invoices/1`);
      assert.equal(res.status, 200);
      const invoice = (await res.json()) as any;
      assert.equal(invoice.id, 1);
      assert.equal(invoice.vendor, 'Northwind Supplies');
      assert.equal(invoice.amount_cents, 124050);
      assert.equal(invoice.status, 'processing');
    });

    it('returns 404 when invoice id does not exist', async () => {
      const res = await fetch(`${baseUrl}/api/invoices/99999`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, 'Invoice not found');
    });

    it('returns 400 when invoice id is invalid', async () => {
      const res = await fetch(`${baseUrl}/api/invoices/abc`);
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, 'Invalid invoice ID');
    });
  });

  describe('PATCH /api/invoices/:id/status', () => {
    it('approves a processing invoice and persists the new status and note', async () => {
      const patchRes = await fetch(`${baseUrl}/api/invoices/1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', note: 'Looks good to pay' }),
      });
      assert.equal(patchRes.status, 200);
      const updated = (await patchRes.json()) as any;
      assert.equal(updated.status, 'approved');
      assert.equal(updated.note, 'Looks good to pay');

      // Verify persistence via GET
      const getRes = await fetch(`${baseUrl}/api/invoices/1`);
      assert.equal(getRes.status, 200);
      const persisted = (await getRes.json()) as any;
      assert.equal(persisted.status, 'approved');
      assert.equal(persisted.note, 'Looks good to pay');
    });

    it('rejects a needs_review invoice and persists', async () => {
      const patchRes = await fetch(`${baseUrl}/api/invoices/3/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', note: 'Too expensive' }),
      });
      assert.equal(patchRes.status, 200);
      const updated = (await patchRes.json()) as any;
      assert.equal(updated.status, 'rejected');
      assert.equal(updated.note, 'Too expensive');
    });

    it('returns 409 when attempting to change an already rejected invoice', async () => {
      // Invoice 6 is seeded as rejected
      const res = await fetch(`${baseUrl}/api/invoices/6/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: string };
      assert.ok(body.error);
      assert.match(body.error, /cannot transition/i);
    });

    it('returns 409 when attempting to change an already approved invoice', async () => {
      // Invoice 5 is seeded as approved
      const res = await fetch(`${baseUrl}/api/invoices/5/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: string };
      assert.ok(body.error);
      assert.match(body.error, /cannot transition/i);
    });

    it('returns 409 when attempting invalid transition from needs_review to processing', async () => {
      // Invoice 3 is seeded as needs_review
      const res = await fetch(`${baseUrl}/api/invoices/3/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing' }),
      });
      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: string };
      assert.ok(body.error);
      assert.match(body.error, /cannot transition/i);
    });

    it('returns 400 for invalid status value', async () => {
      const res = await fetch(`${baseUrl}/api/invoices/1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, 'Invalid status');
    });

    it('returns 400 for invalid note type', async () => {
      const res = await fetch(`${baseUrl}/api/invoices/1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', note: 12345 }),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, 'Invalid note type');
    });

    it('returns 404 when patching missing invoice id', async () => {
      const res = await fetch(`${baseUrl}/api/invoices/99999/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, 'Invoice not found');
    });
  });
});
