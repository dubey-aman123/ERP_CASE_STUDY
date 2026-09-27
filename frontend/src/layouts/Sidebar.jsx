import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/enquiries',    label: 'Enquiries',    icon: '📋', roles: ['ADMIN','SALES_USER'] },
  { to: '/quotations',   label: 'Quotations',   icon: '📄', roles: ['ADMIN','SALES_USER'] },
  { to: '/sales-orders', label: 'Sales Orders', icon: '📦', roles: ['ADMIN','SALES_USER'] },
  { to: '/customers',    label: 'Customers',    icon: '🏢', roles: ['ADMIN','SALES_USER'] },
  { to: '/inventory',    label: 'Inventory',    icon: '🏭', roles: ['ADMIN','SALES_USER'] },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visible = navItems.filter(n => n.roles.includes(user?.role));
  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '??';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>⚙️ ERP System</h1>
        <p>Manufacturing & Supply</p>
      </div>

      <nav className="sidebar-nav">
        {visible.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name" title={user?.name}>{user?.name}</div>
            <div className="user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <button
          className="btn btn-ghost w-full mt-2"
          style={{ justifyContent: 'center', fontSize: '0.78rem' }}
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
