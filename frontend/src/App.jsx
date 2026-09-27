import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';

import EnquiriesPage from './pages/enquiries/EnquiriesPage';
import EnquiryDetailPage from './pages/enquiries/EnquiryDetailPage';

import QuotationsPage from './pages/quotations/QuotationsPage';
import QuotationDetailPage from './pages/quotations/QuotationDetailPage';
import CreateQuotationPage from './pages/quotations/CreateQuotationPage';

import SalesOrdersPage from './pages/salesOrders/SalesOrdersPage';
import SalesOrderDetailPage from './pages/salesOrders/SalesOrderDetailPage';

import CustomersPage from './pages/CustomersPage';
import InventoryPage from './pages/InventoryPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><span className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><span className="spinner" /></div>;
  if (user) return <Navigate to="/enquiries" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/enquiries" replace />} />
        <Route path="enquiries" element={<EnquiriesPage />} />
        <Route path="enquiries/:id" element={<EnquiryDetailPage />} />
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="quotations/create" element={<CreateQuotationPage />} />
        <Route path="quotations/:id" element={<QuotationDetailPage />} />
        <Route path="sales-orders" element={<SalesOrdersPage />} />
        <Route path="sales-orders/:id" element={<SalesOrderDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/enquiries" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1d27',
              color: '#e2e8f0',
              border: '1px solid #2d3148',
              borderRadius: '10px',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
