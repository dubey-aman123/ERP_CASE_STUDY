'use strict';

const router = require('express').Router();
const authController = require('../controllers/authController');
const { loginRules } = require('../validators/rules');
const validate = require('../middleware/validate');

router.post('/login', loginRules, validate, authController.login);

module.exports = router;
