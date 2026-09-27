import { useEffect, useState } from 'react';
import { getCustomers, getProducts, createEnquiry } from '../../services/erpService';
import { getApiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function CreateEnquiryModal({ onClose, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    customer_id: '', enquiry_date: new Date().toISOString().split('T')[0],
    required_date: '', notes: '',
  });
  const [items, setItems] = useState([{ product_id: '', quantity: '', notes: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
      setCustomers(c.data.data);
      setProducts(p.data.data);
    });
  }, []);

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: '', notes: '' }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createEnquiry({ ...form, items });
      toast.success('Enquiry created!');
      onCreated();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">New Customer Enquiry</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select
                className="form-control"
                value={form.customer_id}
                onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                required
              >
                <option value="">Select customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Enquiry Date *</label>
              <input type="date" className="form-control" value={form.enquiry_date}
                onChange={e => setForm(f => ({ ...f, enquiry_date: e.target.value }))} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Required By</label>
              <input type="date" className="form-control" value={form.required_date}
                onChange={e => setForm(f => ({ ...f, required_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input type="text" className="form-control" placeholder="Optional notes"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: '8px' }}>
            <div className="flex justify-between items-center mb-2">
              <label className="form-label" style={{ margin: 0 }}>Products *</label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>+ Add Product</button>
            </div>

            {items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Product</label>}
                  <select className="form-control" value={item.product_id}
                    onChange={e => updateItem(i, 'product_id', e.target.value)} required>
                    <option value="">Select product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.product_name} ({p.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Qty</label>}
                  <input type="number" className="form-control" placeholder="Qty" min="0.01" step="any"
                    value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} required />
                </div>
                <button type="button" className="btn btn-danger btn-sm"
                  style={{ height: '38px' }}
                  onClick={() => removeItem(i)} disabled={items.length === 1}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating...</> : 'Create Enquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
