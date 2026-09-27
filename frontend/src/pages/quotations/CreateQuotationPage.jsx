import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getEnquiry, getCustomers, getProducts, createQuotation } from '../../services/erpService';
import { formatCurrency, getApiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

function calcTotals(items, gst) {
  let subtotal = 0, discountTotal = 0;
  for (const item of items) {
    const base = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    const disc = base * ((parseFloat(item.discount_percent) || 0) / 100);
    subtotal += base;
    discountTotal += disc;
  }
  const taxable = subtotal - discountTotal;
  const tax = taxable * ((parseFloat(gst) || 0) / 100);
  return {
    subtotal: subtotal.toFixed(2),
    discount: discountTotal.toFixed(2),
    taxable: taxable.toFixed(2),
    tax: tax.toFixed(2),
    grand: (taxable + tax).toFixed(2),
  };
}

export default function CreateQuotationPage() {
  const [searchParams] = useSearchParams();
  const enquiryId = searchParams.get('enquiry');
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    enquiry_id: enquiryId || '',
    valid_until: '',
    gst_percent: 18,
    notes: '',
  });
  const [items, setItems] = useState([{ product_id: '', quantity: '', unit_price: '', discount_percent: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getProducts(), getCustomers()]).then(([p, c]) => {
      setProducts(p.data.data);
      setCustomers(c.data.data);
    });
    if (enquiryId) {
      getEnquiry(enquiryId).then(r => {
        setEnquiry(r.data.data);
        setForm(f => ({ ...f, enquiry_id: enquiryId }));
        // Pre-fill items from enquiry
        if (r.data.data.items?.length) {
          setItems(r.data.data.items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.base_price || '',
            discount_percent: 0,
          })));
        }
      });
    }
  }, [enquiryId]);

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: '', unit_price: '', discount_percent: 0 }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) =>
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      // Auto-fill unit price from product base_price
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value);
        if (prod) updated.unit_price = prod.base_price;
      }
      return updated;
    }));

  const totals = calcTotals(items, form.gst_percent);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await createQuotation({ ...form, items });
      toast.success('Quotation created!');
      navigate(`/quotations/${res.data.data.id}`);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-2" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="page-heading">Create Quotation</h2>
          {enquiry && <p className="page-subheading">For Enquiry: <strong>{enquiry.enquiry_number}</strong> — {enquiry.company_name}</p>}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">Quotation Details</span></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Enquiry *</label>
              <input className="form-control" value={enquiry ? `${enquiry.enquiry_number} — ${enquiry.company_name}` : form.enquiry_id} readOnly={!!enquiry}
                onChange={e => !enquiry && setForm(f => ({ ...f, enquiry_id: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Valid Until *</label>
              <input type="date" className="form-control" value={form.valid_until} required
                onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GST %</label>
              <input type="number" className="form-control" value={form.gst_percent} min="0" max="100"
                onChange={e => setForm(f => ({ ...f, gst_percent: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input type="text" className="form-control" placeholder="Optional" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">Line Items</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>+ Add Item</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price (₹)</th>
                  <th>Discount %</th>
                  <th>Line Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const base = (parseFloat(item.quantity)||0) * (parseFloat(item.unit_price)||0);
                  const disc = base * ((parseFloat(item.discount_percent)||0)/100);
                  const lineTotal = base - disc;
                  return (
                    <tr key={i}>
                      <td>
                        <select className="form-control" value={item.product_id}
                          onChange={e => updateItem(i, 'product_id', e.target.value)} required>
                          <option value="">Select...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="number" className="form-control" placeholder="Qty" min="0.01" step="any"
                          value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} required />
                      </td>
                      <td>
                        <input type="number" className="form-control" placeholder="Price" min="0" step="any"
                          value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} required />
                      </td>
                      <td>
                        <input type="number" className="form-control" placeholder="0" min="0" max="100"
                          value={item.discount_percent} onChange={e => updateItem(i, 'discount_percent', e.target.value)} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(lineTotal)}</td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)} disabled={items.length === 1}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="totals-box">
            <div className="totals-row"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
            <div className="totals-row"><span>Discount</span><span style={{ color: 'var(--color-danger)' }}>- {formatCurrency(totals.discount)}</span></div>
            <div className="totals-row"><span>Taxable Amount</span><span>{formatCurrency(totals.taxable)}</span></div>
            <div className="totals-row"><span>GST ({form.gst_percent}%)</span><span>{formatCurrency(totals.tax)}</span></div>
            <div className="totals-row grand"><span>Grand Total</span><span style={{ color: 'var(--color-success)' }}>{formatCurrency(totals.grand)}</span></div>
            <p className="text-xs text-muted mt-2" style={{ marginTop: '8px' }}>Note: Final totals are recalculated by the server. Preview shown above.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner" /> Creating...</> : 'Create Quotation'}
          </button>
        </div>
      </form>
    </div>
  );
}
