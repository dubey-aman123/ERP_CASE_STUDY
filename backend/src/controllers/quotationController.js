'use strict';

const quotationService = require('../services/quotationService');

const createQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.createQuotation(req.body, req.user.id);
    res.status(201).json({ success: true, data: quotation });
  } catch (err) { next(err); }
};

const getAllQuotations = async (req, res, next) => {
  try {
    const quotations = await quotationService.getAllQuotations();
    res.status(200).json({ success: true, data: quotations });
  } catch (err) { next(err); }
};

const getQuotationById = async (req, res, next) => {
  try {
    const quotation = await quotationService.getQuotationById(req.params.id);
    res.status(200).json({ success: true, data: quotation });
  } catch (err) { next(err); }
};

const updateQuotationStatus = async (req, res, next) => {
  try {
    const quotation = await quotationService.updateQuotationStatus(
      req.params.id, req.body.status, req.user.id
    );
    res.status(200).json({ success: true, data: quotation });
  } catch (err) { next(err); }
};

const convertToOrder = async (req, res, next) => {
  try {
    const order = await require('../services/salesOrderService').convertQuotationToOrder(
      req.params.id, req.user.id
    );
    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
};

module.exports = { createQuotation, getAllQuotations, getQuotationById, updateQuotationStatus, convertToOrder };
