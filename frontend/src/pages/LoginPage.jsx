import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../utils/helpers';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/enquiries');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>⚙️ ERP System</h1>
          <p>Manufacturing & Supply Management</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder="admin@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              placeholder="Your password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', marginTop: '8px', padding: '11px' }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', padding: '14px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem' }}>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: '6px', fontWeight: 600 }}>Test Credentials</div>
          <div style={{ color: 'var(--color-text)' }}>ADMIN: <strong>admin@example.com</strong> / <strong>Admin@123</strong></div>
          <div style={{ color: 'var(--color-text)', marginTop: '3px' }}>SALES: <strong>sales@example.com</strong> / <strong>Sales@123</strong></div>
        </div>
      </div>
    </div>
  );
}
