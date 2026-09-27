'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/salesOrderController');
const { authenticate, authorize } = require('../middleware/auth');
const { dispatchRules } = require('../validators/rules');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/', ctrl.getAllSalesOrders);
router.get('/:id', ctrl.getSalesOrderById);
// Only ADMIN can confirm and dispatch
router.post('/:id/confirm', authorize('ADMIN'), ctrl.confirmOrder);
router.post('/:id/dispatch', authorize('ADMIN'), dispatchRules, validate, ctrl.dispatchOrder);
router.post('/:id/cancel', authorize('ADMIN'), ctrl.cancelOrder);

module.exports = router;
