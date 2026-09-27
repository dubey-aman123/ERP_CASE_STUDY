'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ERP System API',
      version: '1.0.0',
      description: `
## Manufacturing & Supply ERP REST API

### Authentication
All endpoints (except /auth/login) require a **Bearer JWT token**.

### Roles
- **ADMIN** — can confirm orders, dispatch, manage inventory
- **SALES_USER** — can create customers, enquiries, quotations, convert to orders

### Business Flow
\`\`\`
Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch
\`\`\`

### Inventory Concurrency
Order confirmation uses \`SELECT ... FOR UPDATE\` row locking so concurrent requests
cannot both succeed when only one has enough stock.
      `,
      contact: { name: 'ERP System' },
    },
    servers: [{ url: 'http://localhost:5000/api', description: 'Development' }],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', example: 'admin@example.com' },
            password: { type: 'string', example: 'Admin@123' },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_name: { type: 'string' },
            contact_person: { type: 'string' },
            mobile: { type: 'string' },
            email: { type: 'string' },
            city: { type: 'string' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            product_code: { type: 'string' },
            product_name: { type: 'string' },
            category: { type: 'string' },
            unit: { type: 'string' },
            base_price: { type: 'number' },
            physical_qty: { type: 'number' },
            reserved_qty: { type: 'number' },
            available_qty: { type: 'number' },
          },
        },
        Enquiry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            enquiry_number: { type: 'string', example: 'ENQ-0001' },
            customer_id: { type: 'string', format: 'uuid' },
            enquiry_date: { type: 'string', format: 'date' },
            required_date: { type: 'string', format: 'date' },
            status: { type: 'string', enum: ['NEW', 'QUOTED', 'WON', 'LOST'] },
            items: { type: 'array', items: { $ref: '#/components/schemas/EnquiryItem' } },
          },
        },
        EnquiryItem: {
          type: 'object',
          properties: {
            product_id: { type: 'string', format: 'uuid' },
            quantity: { type: 'number' },
          },
        },
        Quotation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            quotation_number: { type: 'string', example: 'QT-0001' },
            enquiry_id: { type: 'string', format: 'uuid' },
            grand_total: { type: 'number' },
            status: { type: 'string', enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'] },
          },
        },
        SalesOrder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_number: { type: 'string', example: 'SO-0001' },
            quotation_id: { type: 'string', format: 'uuid' },
            total_amount: { type: 'number' },
            status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED'] },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login and get JWT token',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            200: { description: 'Login successful — returns JWT and user info' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/customers': {
        get: {
          tags: ['Customers'],
          summary: 'List all customers',
          responses: { 200: { description: 'Array of customers' } },
        },
        post: {
          tags: ['Customers'],
          summary: 'Create a customer',
          description: 'Both ADMIN and SALES_USER can create customers.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['company_name', 'contact_person', 'mobile', 'email', 'city'],
                  properties: {
                    company_name: { type: 'string' },
                    contact_person: { type: 'string' },
                    mobile: { type: 'string', description: '10-digit mobile number' },
                    email: { type: 'string', format: 'email' },
                    city: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Customer created' },
            422: { description: 'Validation error' },
          },
        },
      },
      '/products': {
        get: {
          tags: ['Products & Inventory'],
          summary: 'List all active products with inventory',
          responses: { 200: { description: 'Products with stock levels' } },
        },
        post: {
          tags: ['Products & Inventory'],
          summary: 'Create a product (ADMIN only)',
          description: 'Creates product master and an inventory record with 0 stock.',
          responses: { 201: { description: 'Product created' }, 403: { description: 'ADMIN only' } },
        },
      },
      '/products/inventory': {
        get: {
          tags: ['Products & Inventory'],
          summary: 'Get full inventory list',
          responses: { 200: { description: 'Inventory with physical/reserved/available quantities' } },
        },
      },
      '/products/inventory/{productId}': {
        patch: {
          tags: ['Products & Inventory'],
          summary: 'Update physical stock quantity (ADMIN only)',
          description: 'Cannot set physical_qty below reserved_qty.',
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { physical_qty: { type: 'number', minimum: 0 } } } } },
          },
          responses: { 200: { description: 'Updated' }, 400: { description: 'Would violate reserved constraint' }, 403: { description: 'ADMIN only' } },
        },
      },
      '/enquiries': {
        get: { tags: ['Enquiries'], summary: 'List all enquiries', responses: { 200: { description: 'Enquiry list' } } },
        post: {
          tags: ['Enquiries'],
          summary: 'Create an enquiry with line items',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customer_id', 'enquiry_date', 'items'],
                  properties: {
                    customer_id: { type: 'string', format: 'uuid' },
                    enquiry_date: { type: 'string', format: 'date' },
                    required_date: { type: 'string', format: 'date' },
                    notes: { type: 'string' },
                    items: { type: 'array', items: { $ref: '#/components/schemas/EnquiryItem' }, minItems: 1 },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Enquiry created' } },
        },
      },
      '/enquiries/{id}': {
        get: {
          tags: ['Enquiries'],
          summary: 'Get enquiry by ID with all items',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Enquiry detail' }, 404: { description: 'Not found' } },
        },
      },
      '/quotations': {
        get: { tags: ['Quotations'], summary: 'List all quotations', responses: { 200: { description: 'Quotation list' } } },
        post: {
          tags: ['Quotations'],
          summary: 'Create a quotation — backend calculates all totals',
          description: 'The backend recalculates subtotal, discount, GST, and grand_total. Client-submitted totals are IGNORED.',
          responses: { 201: { description: 'Quotation created with server-calculated totals' } },
        },
      },
      '/quotations/{id}': {
        get: {
          tags: ['Quotations'],
          summary: 'Get quotation with full line items and totals',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Quotation detail' } },
        },
      },
      '/quotations/{id}/status': {
        patch: {
          tags: ['Quotations'],
          summary: 'Update quotation status',
          description: 'Allowed transitions: DRAFT→SENT, SENT→ACCEPTED, SENT→REJECTED. ACCEPTED/REJECTED are terminal.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'] } } } } },
          },
          responses: { 200: { description: 'Status updated' }, 400: { description: 'Invalid transition' } },
        },
      },
      '/quotations/{id}/convert': {
        post: {
          tags: ['Quotations'],
          summary: 'Convert ACCEPTED quotation to Sales Order',
          description: 'Only ACCEPTED quotations can be converted. The UNIQUE constraint on quotation_id prevents duplicate orders even under concurrent requests.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            201: { description: 'Sales order created' },
            400: { description: 'Quotation not ACCEPTED' },
            409: { description: 'Sales order already exists for this quotation' },
          },
        },
      },
      '/sales-orders': {
        get: { tags: ['Sales Orders'], summary: 'List all sales orders', responses: { 200: { description: 'Orders list' } } },
      },
      '/sales-orders/{id}': {
        get: {
          tags: ['Sales Orders'],
          summary: 'Get order with items and live inventory',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Order detail with inventory quantities' } },
        },
      },
      '/sales-orders/{id}/confirm': {
        post: {
          tags: ['Sales Orders'],
          summary: 'Confirm order and reserve inventory (ADMIN only)',
          description: `Uses SELECT...FOR UPDATE row locking. Rejects if any product has insufficient available stock. Physical qty unchanged — only reserved_qty increases.`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Order confirmed, inventory reserved' },
            400: { description: 'Insufficient stock' },
            403: { description: 'ADMIN only' },
          },
        },
      },
      '/sales-orders/{id}/dispatch': {
        post: {
          tags: ['Sales Orders'],
          summary: 'Dispatch confirmed order (ADMIN only)',
          description: 'Reduces BOTH physical_qty and reserved_qty. UNIQUE on dispatch.sales_order_id prevents duplicate dispatch.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['vehicle_number', 'driver_name', 'items'],
                  properties: {
                    vehicle_number: { type: 'string' },
                    driver_name: { type: 'string' },
                    dispatch_date: { type: 'string', format: 'date' },
                    items: {
                      type: 'array',
                      items: { type: 'object', properties: { product_id: { type: 'string' }, quantity: { type: 'number' } } },
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Dispatched. Inventory updated.' }, 403: { description: 'ADMIN only' }, 409: { description: 'Already dispatched' } },
        },
      },
      '/sales-orders/{id}/cancel': {
        post: {
          tags: ['Sales Orders'],
          summary: 'Cancel an order (ADMIN only)',
          description: 'If CONFIRMED, releases reserved inventory. Cannot cancel DISPATCHED orders.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Order cancelled' }, 400: { description: 'Cannot cancel in current status' } },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
