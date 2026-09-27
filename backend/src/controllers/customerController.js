'use strict';

const customerService = require('../services/customerService');

const createCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.createCustomer(req.body, req.user.id);
    res.status(201).json({ success: true, data: customer });
  } catch (err) { next(err); }
};

const getAllCustomers = async (req, res, next) => {
  try {
    const customers = await customerService.getAllCustomers();
    res.status(200).json({ success: true, data: customers });
  } catch (err) { next(err); }
};

const getCustomerById = async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    res.status(200).json({ success: true, data: customer });
  } catch (err) { next(err); }
};

module.exports = { createCustomer, getAllCustomers, getCustomerById };
