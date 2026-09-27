import { useEffect, useState } from 'react';
import { getCustomers, createCustomer } from '../services/erpService';
import { formatDate, getApiError } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_person: '', mobile: '', email: '', city: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getCustomers()
      .then(r => setCustomers(r.data.data))
      .catch(err => setError(getApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await createCustomer(form);
      toast.success('Customer created!');
      setShowForm(false);
      setForm({ company_name: '', contact_person: '', mobile: '', email: '', city: '' });
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const f = form;
  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-heading">Customers</h2>
          <p className="page-subheading">Company accounts and contacts</p>
        </div>
        <button id="create-customer-btn" className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Customer'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {showForm && (
        <div className="card mb-4">
          <div className="card-header"><span className="card-title">New Customer</span></div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className="form-control" value={f.company_name} onChange={set('company_name')} required placeholder="Acme Industries Ltd." />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person *</label>
                <input className="form-control" value={f.contact_person} onChange={set('contact_person')} required placeholder="John Smith" />
              </div>
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Mobile * (10 digits)</label>
                <input className="form-control" value={f.mobile} onChange={set('mobile')} required placeholder="9876543210" pattern="[0-9]{10}" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-control" value={f.email} onChange={set('email')} required placeholder="contact@company.com" />
              </div>
              <div className="form-group">
                <label className="form-label">City *</label>
                <input className="form-control" value={f.city} onChange={set('city')} required placeholder="Mumbai" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? <><span className="spinner" /> Creating...</> : 'Create Customer'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading...</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact Person</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No customers yet</td></tr>
                ) : customers.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.company_name}</td>
                    <td>{c.contact_person}</td>
                    <td className="text-sm">{c.mobile}</td>
                    <td className="text-sm">{c.email}</td>
                    <td className="text-sm">{c.city}</td>
                    <td className="text-sm text-muted">{formatDate(c.created_at)}</td>
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
