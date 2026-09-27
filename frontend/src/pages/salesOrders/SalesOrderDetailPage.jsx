import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSalesOrder, confirmOrder, dispatchOrder, cancelOrder } from '../../services/erpService';
import { formatDate, formatCurrency, getApiError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function StatusBadge({ status }) {
  return <span className={`badge badge-${(status||'').toLowerCase()}`}>{status}</span>;
}

export default function SalesOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    vehicle_number: '', driver_name: '', dispatch_date: new Date().toISOString().split('T')[0],
    items: [],
  });

  const load = () => {
    setLoading(true);
    getSalesOrder(id)
      .then(r => {
        setOrder(r.data.data);
        // Pre-fill dispatch items from order items
        setDispatchForm(f => ({
          ...f,
          items: r.data.data.items?.map(i => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
          })) || [],
        }));
      })
      .catch(err => setError(getApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleConfirm = async () => {
    if (!window.confirm('Confirm this order and reserve inventory?')) return;
    setActionLoading(true);
    try {
      await confirmOrder(id);
      toast.success('Order confirmed. Inventory reserved.');
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? This will release any reserved inventory.')) return;
    setActionLoading(true);
    try {
      await cancelOrder(id);
      toast.success('Order cancelled.');
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await dispatchOrder(id, dispatchForm);
      toast.success('Order dispatched. Inventory updated.');
      setShowDispatch(false);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const updateDispatchItem = (i, qty) => {
    setDispatchForm(f => ({
      ...f,
      items: f.items.map((item, idx) => idx === i ? { ...item, quantity: qty } : item),
    }));
  };

  if (loading) return <div className="loading"><span className="spinner" /> Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!order) return null;

  const o = order;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-2" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="page-heading">{o.order_number}</h2>
          <p className="page-subheading">Sales Order for {o.company_name}</p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      {/* Action Buttons — ADMIN only */}
      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {o.status === 'PENDING' && (
            <>
              <button className="btn btn-success" onClick={handleConfirm} disabled={actionLoading}>
                ✅ Confirm & Reserve Stock
              </button>
              <button className="btn btn-danger" onClick={handleCancel} disabled={actionLoading}>
                ✕ Cancel Order
              </button>
            </>
          )}
          {o.status === 'CONFIRMED' && (
            <>
              <button className="btn btn-primary" onClick={() => setShowDispatch(true)} disabled={actionLoading}>
                🚚 Process Dispatch
              </button>
              <button className="btn btn-danger" onClick={handleCancel} disabled={actionLoading}>
                ✕ Cancel Order
              </button>
            </>
          )}
          {actionLoading && <span className="spinner" />}
        </div>
      )}

      <div className="detail-grid mb-3">
        <div className="card">
          <div className="card-header"><span className="card-title">Order Details</span></div>
          <div className="detail-row"><span className="detail-label">Order Number</span><span className="detail-value" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{o.order_number}</span></div>
          <div className="detail-row"><span className="detail-label">Quotation Ref</span><span className="detail-value">{o.quotation_number}</span></div>
          <div className="detail-row"><span className="detail-label">Enquiry Ref</span><span className="detail-value">{o.enquiry_number}</span></div>
          <div className="detail-row"><span className="detail-label">Order Date</span><span className="detail-value">{formatDate(o.order_date)}</span></div>
          <div className="detail-row"><span className="detail-label">Total</span><span className="detail-value" style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(o.total_amount)}</span></div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Customer</span></div>
          <div className="detail-row"><span className="detail-label">Company</span><span className="detail-value">{o.company_name}</span></div>
          <div className="detail-row"><span className="detail-label">Contact</span><span className="detail-value">{o.contact_person}</span></div>
          <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{o.customer_email}</span></div>
          {o.confirmed_at && (
            <div className="detail-row"><span className="detail-label">Confirmed At</span><span className="detail-value">{formatDate(o.confirmed_at)}</span></div>
          )}
        </div>
      </div>

      {/* Order Items with live inventory */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Order Items &amp; Inventory</span>
          <span className="text-sm text-muted">{o.items?.length} product(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Ordered Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
                <th>Physical Stock</th>
                <th>Reserved</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {o.items?.map(item => {
                const avail = parseFloat(item.available_qty);
                const needed = parseFloat(item.quantity);
                const stockOk = avail >= 0;
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                      <div className="text-xs text-muted">{item.product_code}</div>
                    </td>
                    <td className="text-sm">{item.unit}</td>
                    <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                    <td className="text-sm">{formatCurrency(item.unit_price)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(item.line_total)}</td>
                    <td className="text-sm">{item.physical_qty}</td>
                    <td className="text-sm" style={{ color: 'var(--color-warning)' }}>{item.reserved_qty}</td>
                    <td style={{ fontWeight: 600, color: avail < needed ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {item.available_qty}
                      {avail < needed && o.status === 'PENDING' && (
                        <span className="badge badge-danger" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>LOW</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="totals-box" style={{ marginTop: '16px' }}>
          <div className="totals-row grand"><span>Order Total</span><span style={{ color: 'var(--color-success)' }}>{formatCurrency(o.total_amount)}</span></div>
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatch && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDispatch(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">🚚 Process Dispatch</h3>
              <button className="modal-close" onClick={() => setShowDispatch(false)}>✕</button>
            </div>
            <form onSubmit={handleDispatch}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Vehicle Number *</label>
                  <input className="form-control" value={dispatchForm.vehicle_number} required
                    placeholder="MH-12-AB-1234"
                    onChange={e => setDispatchForm(f => ({ ...f, vehicle_number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Driver Name *</label>
                  <input className="form-control" value={dispatchForm.driver_name} required
                    placeholder="Driver name"
                    onChange={e => setDispatchForm(f => ({ ...f, driver_name: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Dispatch Date</label>
                <input type="date" className="form-control" value={dispatchForm.dispatch_date}
                  onChange={e => setDispatchForm(f => ({ ...f, dispatch_date: e.target.value }))} />
              </div>

              <div style={{ marginTop: '12px' }}>
                <label className="form-label">Dispatch Quantities</label>
                {dispatchForm.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>{item.product_name}</div>
                    <div style={{ width: '100px' }}>
                      <input type="number" className="form-control" value={item.quantity}
                        min="0.01" max={item.quantity} step="any"
                        onChange={e => updateDispatchItem(i, e.target.value)} />
                    </div>
                    <span className="text-xs text-muted">/ {o.items?.[i]?.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="alert alert-info" style={{ marginTop: '12px' }}>
                Dispatch will reduce both Physical Stock and Reserved Stock.
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowDispatch(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? <><span className="spinner" /> Dispatching...</> : '🚚 Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
