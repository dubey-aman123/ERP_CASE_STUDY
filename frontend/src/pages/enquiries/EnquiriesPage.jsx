import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEnquiries } from '../../services/erpService';
import { formatDate, getApiError } from '../../utils/helpers';
import CreateEnquiryModal from './CreateEnquiryModal';

function StatusBadge({ status }) {
  const s = (status||'').toLowerCase();
  return <span className={`badge badge-${s}`}>{status}</span>;
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getEnquiries();
      setEnquiries(res.data.data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-heading">Enquiries</h2>
          <p className="page-subheading">Customer enquiries and product requests</p>
        </div>
        <button id="create-enquiry-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Enquiry
        </button>
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
                  <th>Enquiry #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Required By</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No enquiries yet</td></tr>
                ) : enquiries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{e.enquiry_number}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{e.company_name}</div>
                      <div className="text-sm text-muted">{e.contact_person}</div>
                    </td>
                    <td className="text-sm">{formatDate(e.enquiry_date)}</td>
                    <td className="text-sm">{formatDate(e.required_date)}</td>
                    <td><span className="badge" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{e.item_count} items</span></td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>
                      <Link to={`/enquiries/${e.id}`} className="btn btn-ghost btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateEnquiryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
