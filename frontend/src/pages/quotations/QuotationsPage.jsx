import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getQuotations } from '../../services/erpService';
import { formatDate, formatCurrency, getApiError } from '../../utils/helpers';

function StatusBadge({ status }) {
  return <span className={`badge badge-${(status||'').toLowerCase()}`}>{status}</span>;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getQuotations()
      .then(r => setQuotations(r.data.data))
      .catch(err => setError(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-heading">Quotations</h2>
          <p className="page-subheading">Price quotations sent to customers</p>
        </div>
        <Link to="/quotations/create" className="btn btn-primary">+ New Quotation</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading...</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quotation #</th>
                  <th>Enquiry #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Valid Until</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No quotations yet</td></tr>
                ) : quotations.map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{q.quotation_number}</td>
                    <td className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{q.enquiry_number}</td>
                    <td style={{ fontWeight: 500 }}>{q.company_name}</td>
                    <td className="text-sm">{formatDate(q.quotation_date)}</td>
                    <td className="text-sm">{formatDate(q.valid_until)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(q.grand_total)}</td>
                    <td><StatusBadge status={q.status} /></td>
                    <td>
                      <Link to={`/quotations/${q.id}`} className="btn btn-ghost btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
