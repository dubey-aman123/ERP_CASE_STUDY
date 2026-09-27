'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const productRoutes = require('./routes/products');
const enquiryRoutes = require('./routes/enquiries');
const quotationRoutes = require('./routes/quotations');
const salesOrderRoutes = require('./routes/salesOrders');

const app = express();

// Security headers
app.use(helmet());

// CORS — allow all origins in dev, restrict in prod via environment
app.use(cors());

// HTTP request logging
app.use(morgan('dev'));

// Parse JSON bodies
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Swagger API docs — available at http://localhost:5000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'ERP API Docs',
  customCss: '.swagger-ui .topbar { display: none; }',
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/sales-orders', salesOrderRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found.` });
});

// Centralized error handler (must be last)
app.use(errorHandler);

module.exports = app;
