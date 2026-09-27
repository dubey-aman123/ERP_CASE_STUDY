import { useEffect, useState } from 'react';
import { getInventory, updateInventory } from '../services/erpService';
import { formatCurrency, getApiError } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // product_id being edited
  const [editQty, setEditQty] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getInventory()
      .then(r => setInventory(r.data.data))
      .catch(err => setError(getApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (item) => {
    setEditing(item.product_id);
    setEditQty(item.physical_qty);
  };

  const handleUpdate = async (productId) => {
    setUpdateLoading(true);
    try {
      await updateInventory(productId, { physical_qty: parseFloat(editQty) });
      toast.success('Inventory updated!');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setUpdateLoading(false);
    }
  };

  const getAvailColor = (qty) => {
    const n = parseFloat(qty);
    if (n <= 0) return 'var(--color-danger)';
    if (n < 20) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-heading">Inventory</h2>
          <p className="page-subheading">
            Physical stock · Reserved stock · Available stock
            {isAdmin && ' · Click Edit to adjust physical quantity'}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
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
                  <th>Code</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Physical Qty</th>
                  <th>Reserved Qty</th>
                  <th>Available Qty</th>
                  <th>Last Updated</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => (
                  <tr key={item.product_id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.8rem' }}>{item.product_code}</td>
                    <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                    <td className="text-sm text-muted">{item.category}</td>
                    <td className="text-sm">{item.unit}</td>
                    <td style={{ fontWeight: 600 }}>
                      {editing === item.product_id ? (
                        <input
                          type="number" className="form-control" style={{ width: '90px', padding: '4px 8px' }}
                          value={editQty} min="0" step="any"
                          onChange={e => setEditQty(e.target.value)}
                          autoFocus
                        />
                      ) : item.physical_qty}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--color-warning)' }}>{item.reserved_qty}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: getAvailColor(item.available_qty) }}>
                        {item.available_qty}
                      </span>
                    </td>
                    <td className="text-xs text-muted">
                      {item.updated_at ? new Date(item.updated_at).toLocaleString('en-IN') : '—'}
                    </td>
                    {isAdmin && (
                      <td>
                        {editing === item.product_id ? (
                          <div className="flex gap-2">
                            <button className="btn btn-success btn-sm" onClick={() => handleUpdate(item.product_id)} disabled={updateLoading}>
                              {updateLoading ? '...' : '✓ Save'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(item)}>Edit</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert-info" style={{ margin: '16px 0 0 0', fontSize: '0.8rem' }}>
            <strong>Available Qty</strong> = Physical Qty − Reserved Qty.
            Reserved qty increases when an Admin confirms an order and decreases after dispatch.
            Physical qty only changes on dispatch or manual adjustment.
          </div>
        </div>
      )}
    </div>
  );
}
