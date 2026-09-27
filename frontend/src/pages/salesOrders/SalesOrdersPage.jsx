import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSalesOrders } from '../../services/erpService';
import { formatDate, formatCurrency, getApiError } from '../../utils/helpers';

function StatusBadge({ status }) {
  return <span className={`badge badge-${(status||'').toLowerCase()}`}>{status}</span>;
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSalesOrders()
      .then(r => setOrders(r.data.data))
      .catch(err => setError(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-heading">Sales Orders</h2>
          <p className="page-subheading">Confirmed orders and dispatch tracking</p>
        </div>
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
                  <th>Order #</th>
                  <th>Quotation #</th>
                  <th>Customer</th>
                  <th>Order Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No sales orders yet</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{o.order_number}</td>
                    <td className="text-sm text-muted">{o.quotation_number}</td>
                    <td style={{ fontWeight: 500 }}>{o.company_name}</td>
                    <td className="text-sm">{formatDate(o.order_date)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(o.total_amount)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <Link to={`/sales-orders/${o.id}`} className="btn btn-ghost btn-sm">View</Link>
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
