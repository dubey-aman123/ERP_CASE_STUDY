'use strict';

const { body } = require('express-validator');

const loginRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const createCustomerRules = [
  body('company_name').trim().notEmpty().withMessage('Company name is required'),
  body('contact_person').trim().notEmpty().withMessage('Contact person is required'),
  body('mobile').trim().matches(/^[0-9]{10}$/).withMessage('Mobile must be 10 digits'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('city').trim().notEmpty().withMessage('City is required'),
];

const createProductRules = [
  body('product_code').trim().notEmpty().withMessage('Product code is required'),
  body('product_name').trim().notEmpty().withMessage('Product name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('unit').trim().notEmpty().withMessage('Unit is required'),
  body('base_price').isFloat({ min: 0 }).withMessage('Base price must be >= 0'),
];

const createEnquiryRules = [
  body('customer_id').isUUID().withMessage('Valid customer_id required'),
  body('enquiry_date').isDate().withMessage('Valid enquiry_date required'),
  body('required_date').optional().isDate().withMessage('required_date must be a valid date'),
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.product_id').isUUID().withMessage('Each item must have a valid product_id'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Each item quantity must be > 0'),
];

const createQuotationRules = [
  body('enquiry_id').isUUID().withMessage('Valid enquiry_id required'),
  body('valid_until').isDate().withMessage('Valid valid_until date required'),
  body('gst_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('GST must be 0-100'),
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.product_id').isUUID().withMessage('Each item must have a valid product_id'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be > 0'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be >= 0'),
  body('items.*.discount_percent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be 0-100'),
];

const updateQuotationStatusRules = [
  body('status')
    .isIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'])
    .withMessage('Status must be DRAFT, SENT, ACCEPTED, or REJECTED'),
];

const updateInventoryRules = [
  body('physical_qty').isFloat({ min: 0 }).withMessage('physical_qty must be >= 0'),
];

const dispatchRules = [
  body('vehicle_number').trim().notEmpty().withMessage('Vehicle number is required'),
  body('driver_name').trim().notEmpty().withMessage('Driver name is required'),
  body('dispatch_date').optional().isDate().withMessage('dispatch_date must be valid'),
  body('items').isArray({ min: 1 }).withMessage('At least one dispatch item required'),
  body('items.*.product_id').isUUID().withMessage('Each dispatch item needs a valid product_id'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Dispatch quantity must be > 0'),
];

module.exports = {
  loginRules,
  createCustomerRules,
  createProductRules,
  createEnquiryRules,
  createQuotationRules,
  updateQuotationStatusRules,
  updateInventoryRules,
  dispatchRules,
};
