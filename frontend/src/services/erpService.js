import api from './api';

export const login = (credentials) => api.post('/auth/login', credentials);

// Customers
export const getCustomers = () => api.get('/customers');
export const createCustomer = (data) => api.post('/customers', data);

// Products
export const getProducts = () => api.get('/products');
export const createProduct = (data) => api.post('/products', data);
export const getInventory = () => api.get('/products/inventory');
export const updateInventory = (productId, data) => api.patch(`/products/inventory/${productId}`, data);

// Enquiries
export const getEnquiries = () => api.get('/enquiries');
export const getEnquiry = (id) => api.get(`/enquiries/${id}`);
export const createEnquiry = (data) => api.post('/enquiries', data);

// Quotations
export const getQuotations = () => api.get('/quotations');
export const getQuotation = (id) => api.get(`/quotations/${id}`);
export const createQuotation = (data) => api.post('/quotations', data);
export const updateQuotationStatus = (id, status) => api.patch(`/quotations/${id}/status`, { status });
export const convertToOrder = (id) => api.post(`/quotations/${id}/convert`);

// Sales Orders
export const getSalesOrders = () => api.get('/sales-orders');
export const getSalesOrder = (id) => api.get(`/sales-orders/${id}`);
export const confirmOrder = (id) => api.post(`/sales-orders/${id}/confirm`);
export const dispatchOrder = (id, data) => api.post(`/sales-orders/${id}/dispatch`, data);
export const cancelOrder = (id) => api.post(`/sales-orders/${id}/cancel`);
