let allInvoices = [];
let currentTab = 'processing';
let selectedInvoiceId = null;
let isLoading = false;

const STATUS_LABELS = {
  processing: 'Processing',
  needs_review: 'Needs Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

function formatMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function formatDate(str) {
  if (!str) return '';
  if (str.length === 10) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

function getTabInvoices(tab) {
  if (tab === 'processing') return allInvoices.filter((i) => i.status === 'processing');
  if (tab === 'needs_review') return allInvoices.filter((i) => i.status === 'needs_review');
  return allInvoices.filter((i) => i.status === 'approved' || i.status === 'rejected');
}

function updateBadges() {
  const counts = {
    processing: allInvoices.filter((i) => i.status === 'processing').length,
    needs_review: allInvoices.filter((i) => i.status === 'needs_review').length,
    approved_rejected: allInvoices.filter((i) => i.status === 'approved' || i.status === 'rejected').length,
  };
  for (const [key, val] of Object.entries(counts)) {
    const badge = document.getElementById(`badge-${key}`);
    if (badge) badge.textContent = val;
  }
}

function renderInvoicesTable() {
  const container = document.getElementById('invoices-container');
  const invoices = getTabInvoices(currentTab);

  if (isLoading) {
    container.innerHTML = `
      <div class="state-container">
        <div class="spinner"></div>
        <div class="state-title">Loading invoices...</div>
      </div>`;
    return;
  }

  if (invoices.length === 0) {
    const labels = { processing: 'Processing', needs_review: 'Needs review', approved_rejected: 'Approved / rejected' };
    container.innerHTML = `
      <div class="state-container">
        <div class="state-title">No invoices in ${labels[currentTab]}</div>
        <div class="state-desc">There are currently no items under this tab.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="invoices-table" role="table" aria-label="Invoices list">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Status</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map((inv) => `
            <tr class="invoice-row ${inv.id === selectedInvoiceId ? 'active' : ''}" data-id="${inv.id}" tabindex="0" role="button">
              <td class="vendor-cell">
                <div class="vendor-name">${esc(inv.vendor)}</div>
                <div class="invoice-no">#${esc(inv.invoice_number)}</div>
              </td>
              <td class="amount-cell">${formatMoney(inv.amount_cents, inv.currency)}</td>
              <td class="date-cell">${formatDate(inv.issue_date)}</td>
              <td><span class="badge badge-${inv.status}">${STATUS_LABELS[inv.status] || inv.status}</span></td>
              <td>${inv.duplicate_of ? '<span class="badge badge-duplicate">Duplicate</span>' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll('.invoice-row').forEach((row) => {
    const id = Number(row.dataset.id);
    const select = () => selectInvoice(id);
    row.addEventListener('click', select);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });
}

function renderDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (!selectedInvoiceId) {
    panel.innerHTML = `
      <div class="state-container">
        <div class="state-title">No invoice selected</div>
        <div class="state-desc">Select an invoice from the queue to view its details, review duplicate alerts, or approve/reject.</div>
      </div>`;
    return;
  }

  const invoice = allInvoices.find((i) => i.id === selectedInvoiceId);
  if (!invoice) {
    panel.innerHTML = `
      <div class="state-container">
        <div class="state-title">Invoice not found</div>
      </div>`;
    return;
  }

  const isDuplicate = invoice.duplicate_of !== null;
  const original = isDuplicate ? allInvoices.find((i) => i.id === invoice.duplicate_of) : null;
  const canAction = invoice.status === 'processing' || invoice.status === 'needs_review';

  const origInfo = original
    ? `Invoice #${original.id} (${esc(original.invoice_number)})`
    : `Invoice #${invoice.duplicate_of}`;

  panel.innerHTML = `
    <div class="detail-header">
      <div>
        <h2 class="detail-title">${esc(invoice.vendor)}</h2>
        <div class="detail-subtitle">Invoice #${esc(invoice.invoice_number)}</div>
      </div>
      <div><span class="badge badge-${invoice.status}">${STATUS_LABELS[invoice.status] || invoice.status}</span></div>
    </div>

    ${isDuplicate ? `
      <div class="duplicate-banner" id="duplicate-warning">
        <div>
          <strong>Duplicate Invoice Warning</strong>
          <div>This invoice appears to be a duplicate of ${origInfo}. Verify records before approving.</div>
        </div>
      </div>` : ''}

    <div class="detail-grid">
      <div class="detail-field">
        <span class="field-label">Amount</span>
        <span class="field-value amount">${formatMoney(invoice.amount_cents, invoice.currency)}</span>
      </div>
      <div class="detail-field">
        <span class="field-label">Issue Date</span>
        <span class="field-value">${formatDate(invoice.issue_date)}</span>
      </div>
      <div class="detail-field">
        <span class="field-label">Status</span>
        <span class="field-value">${STATUS_LABELS[invoice.status] || invoice.status}</span>
      </div>
      ${isDuplicate ? `
        <div class="detail-field">
          <span class="field-label">Duplicate of</span>
          <span class="field-value" style="color: var(--danger);">${origInfo}</span>
        </div>` : ''}
      <div class="detail-field">
        <span class="field-label">Note</span>
        <span class="field-value">${invoice.note ? esc(invoice.note) : 'No note'}</span>
      </div>
      <div class="detail-field">
        <span class="field-label">Last Updated</span>
        <span class="field-value">${formatDate(invoice.updated_at)}</span>
      </div>
    </div>

    ${canAction ? `
      <div class="action-box">
        <label for="action-note-input" class="action-note-label">Reviewer Note (optional)</label>
        <textarea id="action-note-input" class="action-note-input" placeholder="Add any internal context or reasoning for this decision...">${invoice.note ? esc(invoice.note) : ''}</textarea>
        <div class="action-buttons">
          <button id="btn-approve" class="btn btn-approve" type="button">Approve</button>
          <button id="btn-reject" class="btn btn-reject" type="button">Reject</button>
        </div>
      </div>` : `
      <div class="final-notice">
        <span>Decision is final (${STATUS_LABELS[invoice.status]}). Status cannot be changed.</span>
      </div>`}
  `;

  if (canAction) {
    const noteInput = document.getElementById('action-note-input');
    document.getElementById('btn-approve')?.addEventListener('click', () => {
      updateStatus(invoice.id, 'approved', noteInput?.value.trim());
    });
    document.getElementById('btn-reject')?.addEventListener('click', () => {
      updateStatus(invoice.id, 'rejected', noteInput?.value.trim());
    });
  }
}

function selectInvoice(id) {
  selectedInvoiceId = id;
  renderInvoicesTable();
  renderDetailPanel();
}

async function updateStatus(id, newStatus, note) {
  const btnApprove = document.getElementById('btn-approve');
  const btnReject = document.getElementById('btn-reject');
  if (btnApprove) btnApprove.disabled = true;
  if (btnReject) btnReject.disabled = true;

  try {
    const res = await fetch(`/api/invoices/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, note: note || null }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');

    showToast(`Invoice #${data.invoice_number} successfully marked as ${newStatus}!`, 'success');

    const index = allInvoices.findIndex((inv) => inv.id === id);
    if (index !== -1) allInvoices[index] = data;

    updateBadges();
    renderInvoicesTable();
    renderDetailPanel();
  } catch (err) {
    showToast(err.message, 'error');
    if (btnApprove) btnApprove.disabled = false;
    if (btnReject) btnReject.disabled = false;
  }
}

async function fetchInvoices() {
  isLoading = true;
  renderInvoicesTable();

  try {
    const res = await fetch('/api/invoices');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to load invoices');
    }
    allInvoices = await res.json();

    if (selectedInvoiceId && !allInvoices.some((i) => i.id === selectedInvoiceId)) {
      selectedInvoiceId = null;
    }

    const tabInvoices = getTabInvoices(currentTab);
    if (!selectedInvoiceId && tabInvoices.length > 0) {
      selectedInvoiceId = tabInvoices[0].id;
    }

    updateBadges();
    renderInvoicesTable();
    renderDetailPanel();
  } catch (err) {
    const container = document.getElementById('invoices-container');
    container.innerHTML = `
      <div class="state-container">
        <div class="state-title">Error loading invoices</div>
        <div class="state-desc">${esc(err.message)}</div>
        <button id="btn-retry" class="btn" style="margin-top: 12px; background: var(--bg-surface); border: 1px solid var(--border-light);">Retry</button>
      </div>`;
    document.getElementById('btn-retry')?.addEventListener('click', fetchInvoices);
    showToast(err.message, 'error');
  } finally {
    isLoading = false;
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (tabName === currentTab) return;

      currentTab = tabName;
      tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));

      const tabInvoices = getTabInvoices(currentTab);
      if (!tabInvoices.some((i) => i.id === selectedInvoiceId)) {
        selectedInvoiceId = tabInvoices.length > 0 ? tabInvoices[0].id : null;
      }

      renderInvoicesTable();
      renderDetailPanel();
    });
  });
}

function openModal() {
  const overlay = document.getElementById('modal-overlay');
  const errorEl = document.getElementById('modal-error');
  if (errorEl) errorEl.classList.add('hidden');
  document.getElementById('add-invoice-form')?.reset();
  overlay?.classList.remove('hidden');
  document.getElementById('inv-vendor')?.focus();
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

function setupModal() {
  document.getElementById('btn-add-invoice')?.addEventListener('click', openModal);
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  const form = document.getElementById('add-invoice-form');
  const errorEl = document.getElementById('modal-error');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.classList.add('hidden');

    const vendor = document.getElementById('inv-vendor')?.value.trim();
    const invoice_number = document.getElementById('inv-number')?.value.trim();
    const amountVal = parseFloat(document.getElementById('inv-amount')?.value);
    const issue_date = document.getElementById('inv-date')?.value;
    const amount_cents = Math.round(amountVal * 100);

    const submitBtn = document.getElementById('modal-submit');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, invoice_number, amount_cents, issue_date }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');

      closeModal();
      showToast(`Invoice #${data.invoice_number} created successfully!`, 'success');

      const targetTab = data.status === 'needs_review' ? 'needs_review' : 'processing';
      currentTab = targetTab;
      selectedInvoiceId = data.id;
      document.querySelectorAll('.tab-btn').forEach((t) => {
        t.setAttribute('aria-selected', t.dataset.tab === targetTab ? 'true' : 'false');
      });

      await fetchInvoices();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      }
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

setupTabs();
setupModal();
fetchInvoices();

