'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/quotationController');
const { authenticate } = require('../middleware/auth');
const { createQuotationRules, updateQuotationStatusRules } = require('../validators/rules');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/', ctrl.getAllQuotations);
router.get('/:id', ctrl.getQuotationById);
router.post('/', createQuotationRules, validate, ctrl.createQuotation);
router.patch('/:id/status', updateQuotationStatusRules, validate, ctrl.updateQuotationStatus);
// Sales users can convert an ACCEPTED quotation to an order
router.post('/:id/convert', ctrl.convertToOrder);

module.exports = router;
