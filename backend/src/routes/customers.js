'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');
const { createCustomerRules } = require('../validators/rules');
const validate = require('../middleware/validate');

// Both roles can view and create customers
router.use(authenticate);
router.get('/', ctrl.getAllCustomers);
router.get('/:id', ctrl.getCustomerById);
router.post('/', createCustomerRules, validate, ctrl.createCustomer);

module.exports = router;
