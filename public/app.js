// Invoice Approval Desk - Client Application

let allInvoices = [];
let currentTab = 'processing'; // 'processing' | 'needs_review' | 'approved_rejected'
let selectedInvoiceId = null;
let isLoading = false;

// Format cents into currency
function formatCurrency(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(cents / 100);
}

// Format ISO date / timestamp into readable format
function formatDate(dateString) {
  if (!dateString) return '—';
  // If it's a date only (YYYY-MM-DD)
  if (dateString.length === 10) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Filter invoices for current tab
function getTabInvoices(tab) {
  if (tab === 'processing') {
    return allInvoices.filter((inv) => inv.status === 'processing');
  }
  if (tab === 'needs_review') {
    return allInvoices.filter((inv) => inv.status === 'needs_review');
  }
  if (tab === 'approved_rejected') {
    return allInvoices.filter((inv) => inv.status === 'approved' || inv.status === 'rejected');
  }
  return allInvoices;
}

// Update Tab Badges
function updateTabBadges() {
  const processingCount = allInvoices.filter((inv) => inv.status === 'processing').length;
  const needsReviewCount = allInvoices.filter((inv) => inv.status === 'needs_review').length;
  const approvedRejectedCount = allInvoices.filter(
    (inv) => inv.status === 'approved' || inv.status === 'rejected'
  ).length;

  const bp = document.getElementById('badge-processing');
  const bn = document.getElementById('badge-needs_review');
  const ba = document.getElementById('badge-approved_rejected');
  if (bp) bp.textContent = processingCount;
  if (bn) bn.textContent = needsReviewCount;
  if (ba) ba.textContent = approvedRejectedCount;
}

// Render Invoices Table
function renderInvoicesTable() {
  const tableContainer = document.getElementById('invoices-container');
  const invoices = getTabInvoices(currentTab);

  if (isLoading) {
    tableContainer.innerHTML = `
      <div class="state-container">
        <div class="spinner"></div>
        <div class="state-title">Loading invoices...</div>
      </div>
    `;
    return;
  }

  if (invoices.length === 0) {
    const tabLabels = {
      processing: 'Processing',
      needs_review: 'Needs review',
      approved_rejected: 'Approved / rejected',
    };
    tableContainer.innerHTML = `
      <div class="state-container">
        <div class="state-icon">📋</div>
        <div class="state-title">No invoices in ${tabLabels[currentTab]}</div>
        <div class="state-desc">There are currently no items under this tab.</div>
      </div>
    `;
    return;
  }

  let tableHtml = `
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
  `;

  for (const inv of invoices) {
    const isSelected = inv.id === selectedInvoiceId;
    const isDuplicate = inv.duplicate_of !== null;
    const statusLabels = {
      processing: 'Processing',
      needs_review: 'Needs Review',
      approved: 'Approved',
      rejected: 'Rejected',
    };

    tableHtml += `
      <tr 
        class="invoice-row ${isSelected ? 'active' : ''}" 
        data-id="${inv.id}" 
        tabindex="0"
        role="button"
        aria-selected="${isSelected}"
        aria-label="Invoice ${inv.invoice_number} from ${inv.vendor}"
      >
        <td class="vendor-cell">
          <div class="vendor-name">${escapeHtml(inv.vendor)}</div>
          <div class="invoice-no">#${escapeHtml(inv.invoice_number)}</div>
        </td>
        <td class="amount-cell">${formatCurrency(inv.amount_cents, inv.currency)}</td>
        <td class="date-cell">${formatDate(inv.issue_date)}</td>
        <td>
          <span class="badge badge-${inv.status}">
            ${statusLabels[inv.status] || inv.status}
          </span>
        </td>
        <td>
          ${isDuplicate ? `<span class="badge badge-duplicate">Duplicate</span>` : '—'}
        </td>
      </tr>
    `;
  }

  tableHtml += `
        </tbody>
      </table>
    </div>
  `;

  tableContainer.innerHTML = tableHtml;

  // Bind click and keyboard events
  const rows = tableContainer.querySelectorAll('.invoice-row');
  rows.forEach((row) => {
    const id = parseInt(row.getAttribute('data-id'), 10);
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

// Render Detail Panel
function renderDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (!selectedInvoiceId) {
    panel.innerHTML = `
      <div class="state-container">
        <div class="state-icon">📄</div>
        <div class="state-title">No invoice selected</div>
        <div class="state-desc">Select an invoice from the queue to view its details, review duplicate alerts, or approve/reject.</div>
      </div>
    `;
    return;
  }

  const invoice = allInvoices.find((inv) => inv.id === selectedInvoiceId);
  if (!invoice) {
    panel.innerHTML = `
      <div class="state-container">
        <div class="state-icon">❓</div>
        <div class="state-title">Invoice not found</div>
      </div>
    `;
    return;
  }

  const isDuplicate = invoice.duplicate_of !== null;
  const originalInvoice = isDuplicate
    ? allInvoices.find((inv) => inv.id === invoice.duplicate_of)
    : null;

  const statusLabels = {
    processing: 'Processing',
    needs_review: 'Needs Review',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  const canAction = invoice.status === 'processing' || invoice.status === 'needs_review';

  let duplicateWarningHtml = '';
  if (isDuplicate) {
    const origText = originalInvoice
      ? `original invoice #${escapeHtml(originalInvoice.invoice_number)} (${escapeHtml(originalInvoice.vendor)}, ${formatCurrency(originalInvoice.amount_cents, originalInvoice.currency)})`
      : `original invoice #${invoice.duplicate_of}`;

    duplicateWarningHtml = `
      <div class="duplicate-banner" id="duplicate-warning">
        <div class="duplicate-banner-icon">⚠️</div>
        <div>
          <strong>Duplicate Invoice Warning</strong>
          <div>This invoice appears to be a duplicate of ${origText}. Verify records before approving.</div>
        </div>
      </div>
    `;
  }

  let actionsHtml = '';
  if (canAction) {
    actionsHtml = `
      <div class="action-box">
        <label for="action-note-input" class="action-note-label">Reviewer Note (optional)</label>
        <textarea 
          id="action-note-input" 
          class="action-note-input" 
          placeholder="Add any internal context or reasoning for this decision..."
        >${invoice.note ? escapeHtml(invoice.note) : ''}</textarea>
        <div class="action-buttons">
          <button id="btn-approve" class="btn btn-approve" type="button">
            <span>✓</span> Approve
          </button>
          <button id="btn-reject" class="btn btn-reject" type="button">
            <span>✕</span> Reject
          </button>
        </div>
      </div>
    `;
  } else {
    actionsHtml = `
      <div class="final-notice">
        <span>🔒</span>
        <span>Decision is final (${statusLabels[invoice.status]}). Status cannot be changed.</span>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="detail-header">
      <div>
        <h2 class="detail-title">${escapeHtml(invoice.vendor)}</h2>
        <div class="detail-subtitle">Invoice #${escapeHtml(invoice.invoice_number)}</div>
      </div>
      <div>
        <span class="badge badge-${invoice.status}">
          ${statusLabels[invoice.status] || invoice.status}
        </span>
      </div>
    </div>

    ${duplicateWarningHtml}

    <div class="detail-grid">
      <div class="detail-field">
        <span class="field-label">Amount</span>
        <span class="field-value amount">${formatCurrency(invoice.amount_cents, invoice.currency)}</span>
      </div>
      <div class="detail-field">
        <span class="field-label">Issue Date</span>
        <span class="field-value">${formatDate(invoice.issue_date)}</span>
      </div>
      <div class="detail-field">
        <span class="field-label">Status</span>
        <span class="field-value">${statusLabels[invoice.status] || invoice.status}</span>
      </div>
      ${
        isDuplicate
          ? `<div class="detail-field">
              <span class="field-label">Duplicate of</span>
              <span class="field-value" style="color: var(--danger);">Invoice #${invoice.duplicate_of}</span>
            </div>`
          : ''
      }
      <div class="detail-field">
        <span class="field-label">Note</span>
        <span class="field-value">${invoice.note ? escapeHtml(invoice.note) : '—'}</span>
      </div>
      <div class="detail-field">
        <span class="field-label">Last Updated</span>
        <span class="field-value">${formatDate(invoice.updated_at)}</span>
      </div>
    </div>

    ${actionsHtml}
  `;

  if (canAction) {
    const btnApprove = document.getElementById('btn-approve');
    const btnReject = document.getElementById('btn-reject');
    const noteInput = document.getElementById('action-note-input');

    if (btnApprove) {
      btnApprove.addEventListener('click', () => {
        handleStatusUpdate(invoice.id, 'approved', noteInput ? noteInput.value.trim() : undefined);
      });
    }

    if (btnReject) {
      btnReject.addEventListener('click', () => {
        handleStatusUpdate(invoice.id, 'rejected', noteInput ? noteInput.value.trim() : undefined);
      });
    }
  }
}

// Select an Invoice
function selectInvoice(id) {
  selectedInvoiceId = id;
  renderInvoicesTable();
  renderDetailPanel();
}

// Handle Status Update (Approve / Reject)
async function handleStatusUpdate(id, newStatus, note) {
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
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update status');
    }

    showToast(`Invoice #${data.invoice_number} successfully marked as ${newStatus}!`, 'success');

    // Update in local state
    const index = allInvoices.findIndex((inv) => inv.id === id);
    if (index !== -1) {
      allInvoices[index] = data;
    }

    updateTabBadges();
    renderInvoicesTable();
    renderDetailPanel();
  } catch (err) {
    showToast(err.message, 'error');
    if (btnApprove) btnApprove.disabled = false;
    if (btnReject) btnReject.disabled = false;
  }
}

// Fetch Invoices from Server
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

    // If an invoice is currently selected, verify it still exists
    if (selectedInvoiceId && !allInvoices.some((inv) => inv.id === selectedInvoiceId)) {
      selectedInvoiceId = null;
    }

    // Auto-select first invoice in current tab if none selected
    const tabInvoices = getTabInvoices(currentTab);
    if (!selectedInvoiceId && tabInvoices.length > 0) {
      selectedInvoiceId = tabInvoices[0].id;
    }

    updateTabBadges();
    renderInvoicesTable();
    renderDetailPanel();
  } catch (err) {
    const container = document.getElementById('invoices-container');
    container.innerHTML = `
      <div class="state-container">
        <div class="state-icon">⚠️</div>
        <div class="state-title">Error loading invoices</div>
        <div class="state-desc">${escapeHtml(err.message)}</div>
        <button id="btn-retry" class="btn btn-icon" style="margin-top: 12px;">Retry</button>
      </div>
    `;
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) {
      btnRetry.addEventListener('click', fetchInvoices);
    }
    showToast(err.message, 'error');
  } finally {
    isLoading = false;
  }
}

// Setup Tabs Navigation
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName === currentTab) return;

      currentTab = tabName;
      tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));

      // Auto-select first item of newly active tab if current selection is not in this tab
      const tabInvoices = getTabInvoices(currentTab);
      if (!tabInvoices.some((inv) => inv.id === selectedInvoiceId)) {
        selectedInvoiceId = tabInvoices.length > 0 ? tabInvoices[0].id : null;
      }

      renderInvoicesTable();
      renderDetailPanel();
    });
  });
}

// Setup Dark Mode
function setupTheme() {
  const toggleBtn = document.getElementById('btn-theme-toggle');
  const storedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const currentTheme = storedTheme || (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Helper: Escape HTML strings to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Initialize on DOM load or immediately if already ready
function init() {
  setupTheme();
  setupTabs();

  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', fetchInvoices);
  }

  fetchInvoices();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
