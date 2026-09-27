import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEnquiry } from '../../services/erpService';
import { formatDate, getApiError } from '../../utils/helpers';

function StatusBadge({ status }) {
  return <span className={`badge badge-${(status||'').toLowerCase()}`}>{status}</span>;
}

export default function EnquiryDetailPage() {
  const { id } = useParams();
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getEnquiry(id)
      .then(r => setEnquiry(r.data.data))
      .catch(err => setError(getApiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading"><span className="spinner" /> Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!enquiry) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-2" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="page-heading">{enquiry.enquiry_number}</h2>
          <p className="page-subheading">Enquiry Details</p>
        </div>
        <StatusBadge status={enquiry.status} />
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">Customer Information</span></div>
          <div className="detail-row"><span className="detail-label">Company</span><span className="detail-value">{enquiry.company_name}</span></div>
          <div className="detail-row"><span className="detail-label">Contact</span><span className="detail-value">{enquiry.contact_person}</span></div>
          <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{enquiry.customer_email}</span></div>
          <div className="detail-row"><span className="detail-label">Mobile</span><span className="detail-value">{enquiry.mobile}</span></div>
          <div className="detail-row"><span className="detail-label">City</span><span className="detail-value">{enquiry.city}</span></div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Enquiry Information</span></div>
          <div className="detail-row"><span className="detail-label">Enquiry Number</span><span className="detail-value" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{enquiry.enquiry_number}</span></div>
          <div className="detail-row"><span className="detail-label">Enquiry Date</span><span className="detail-value">{formatDate(enquiry.enquiry_date)}</span></div>
          <div className="detail-row"><span className="detail-label">Required By</span><span className="detail-value">{formatDate(enquiry.required_date)}</span></div>
          <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><StatusBadge status={enquiry.status} /></span></div>
          {enquiry.notes && <div className="detail-row"><span className="detail-label">Notes</span><span className="detail-value">{enquiry.notes}</span></div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Enquiry Items</span>
          <span className="text-sm text-muted">{enquiry.items?.length} product(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Quantity</th>
                <th>Base Price</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {enquiry.items?.map(item => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{item.product_code}</td>
                  <td>{item.product_name}</td>
                  <td className="text-sm text-muted">{item.category}</td>
                  <td className="text-sm">{item.unit}</td>
                  <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                  <td className="text-sm">₹{Number(item.base_price).toLocaleString('en-IN')}</td>
                  <td className="text-sm text-muted">{item.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {enquiry.status === 'QUOTED' || enquiry.status === 'NEW' ? (
          <div style={{ marginTop: '16px' }}>
            <Link to={`/quotations/create?enquiry=${enquiry.id}`} className="btn btn-primary">
              📄 Create Quotation
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
