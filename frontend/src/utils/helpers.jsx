// Utility helpers shared across the frontend

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function statusBadge(status) {
  const s = (status || '').toLowerCase().replace('_', '-');
  return <span className={`badge badge-${s}`}>{status}</span>;
}

export function getApiError(err) {
  return err?.response?.data?.error || err?.message || 'An error occurred';
}
