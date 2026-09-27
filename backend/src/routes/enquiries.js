'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/enquiryController');
const { authenticate } = require('../middleware/auth');
const { createEnquiryRules } = require('../validators/rules');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/', ctrl.getAllEnquiries);
router.get('/:id', ctrl.getEnquiryById);
router.post('/', createEnquiryRules, validate, ctrl.createEnquiry);

module.exports = router;
