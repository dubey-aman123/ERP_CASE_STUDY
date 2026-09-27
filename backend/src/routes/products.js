'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { createProductRules, updateInventoryRules } = require('../validators/rules');
const validate = require('../middleware/validate');

router.use(authenticate);

// Products
router.get('/', ctrl.getAllProducts);
router.post('/', authorize('ADMIN'), createProductRules, validate, ctrl.createProduct);

// Inventory
router.get('/inventory', ctrl.getInventory);
router.patch('/inventory/:productId', authorize('ADMIN'), updateInventoryRules, validate, ctrl.updateInventory);

module.exports = router;
