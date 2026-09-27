import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getQuotation, updateQuotationStatus, convertToOrder } from '../../services/erpService';
import { formatDate, formatCurrency, getApiError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function StatusBadge({ status }) {
  return <span className={`badge badge-${(status||'').toLowerCase()}`}>{status}</span>;
}

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getQuotation(id)
      .then(r => setQuotation(r.data.data))
      .catch(err => setError(getApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleStatus = async (newStatus) => {
    setActionLoading(true);
    try {
      await updateQuotationStatus(id, newStatus);
      toast.success(`Quotation marked as ${newStatus}`);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!window.confirm('Convert this accepted quotation to a Sales Order?')) return;
    setActionLoading(true);
    try {
      const res = await convertToOrder(id);
      toast.success('Sales Order created!');
      navigate(`/sales-orders/${res.data.data.id}`);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="loading"><span className="spinner" /> Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!quotation) return null;

  const q = quotation;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-2" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="page-heading">{q.quotation_number}</h2>
          <p className="page-subheading">Quotation for {q.company_name}</p>
        </div>
        <div className="flex gap-2 items-center">
          <StatusBadge status={q.status} />
        </div>
      </div>

      {/* Action Buttons based on status */}
      <div className="flex gap-2 mb-4">
        {q.status === 'DRAFT' && (
          <button className="btn btn-primary" onClick={() => handleStatus('SENT')} disabled={actionLoading}>
            📤 Mark as Sent
          </button>
        )}
        {q.status === 'SENT' && (
          <>
            <button className="btn btn-success" onClick={() => handleStatus('ACCEPTED')} disabled={actionLoading}>
              ✅ Accept Quotation
            </button>
            <button className="btn btn-danger" onClick={() => handleStatus('REJECTED')} disabled={actionLoading}>
              ❌ Reject Quotation
            </button>
          </>
        )}
        {q.status === 'ACCEPTED' && (
          <button className="btn btn-success" onClick={handleConvert} disabled={actionLoading}>
            📦 Convert to Sales Order
          </button>
        )}
        {actionLoading && <span className="spinner" />}
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">Customer</span></div>
          <div className="detail-row"><span className="detail-label">Company</span><span className="detail-value">{q.company_name}</span></div>
          <div className="detail-row"><span className="detail-label">Contact</span><span className="detail-value">{q.contact_person}</span></div>
          <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{q.customer_email}</span></div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Quotation Info</span></div>
          <div className="detail-row"><span className="detail-label">Enquiry Ref</span><span className="detail-value" style={{ color: 'var(--color-primary)' }}>{q.enquiry_number}</span></div>
          <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{formatDate(q.quotation_date)}</span></div>
          <div className="detail-row"><span className="detail-label">Valid Until</span><span className="detail-value">{formatDate(q.valid_until)}</span></div>
          <div className="detail-row"><span className="detail-label">GST Rate</span><span className="detail-value">{q.gst_percent}%</span></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header"><span className="card-title">Line Items</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Base Amount</th>
                <th>Discount Amt</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {q.items?.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                    <div className="text-xs text-muted">{item.product_code}</div>
                  </td>
                  <td className="text-sm">{item.unit}</td>
                  <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                  <td className="text-sm">{formatCurrency(item.unit_price)}</td>
                  <td className="text-sm">{item.discount_percent}%</td>
                  <td className="text-sm">{formatCurrency(item.base_amount)}</td>
                  <td className="text-sm" style={{ color: 'var(--color-danger)' }}>- {formatCurrency(item.discount_amount)}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="totals-box">
          <div className="totals-row"><span>Subtotal</span><span>{formatCurrency(q.subtotal)}</span></div>
          <div className="totals-row"><span>Total Discount</span><span style={{ color: 'var(--color-danger)' }}>- {formatCurrency(q.discount_amount)}</span></div>
          <div className="totals-row"><span>Taxable Amount</span><span>{formatCurrency(q.taxable_amount)}</span></div>
          <div className="totals-row"><span>GST ({q.gst_percent}%)</span><span>{formatCurrency(q.tax_amount)}</span></div>
          <div className="totals-row grand"><span>Grand Total</span><span style={{ color: 'var(--color-success)' }}>{formatCurrency(q.grand_total)}</span></div>
        </div>
      </div>

      {q.notes && (
        <div className="card">
          <div className="card-header"><span className="card-title">Notes</span></div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{q.notes}</p>
        </div>
      )}
    </div>
  );
}
