'use strict';

const salesOrderService = require('../services/salesOrderService');

const getAllSalesOrders = async (req, res, next) => {
  try {
    const orders = await salesOrderService.getAllSalesOrders();
    res.status(200).json({ success: true, data: orders });
  } catch (err) { next(err); }
};

const getSalesOrderById = async (req, res, next) => {
  try {
    const order = await salesOrderService.getSalesOrderById(req.params.id);
    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

const confirmOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.confirmOrder(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: order, message: 'Order confirmed and inventory reserved.' });
  } catch (err) { next(err); }
};

const dispatchOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.dispatchOrder(req.params.id, req.body, req.user.id);
    res.status(200).json({ success: true, data: order, message: 'Order dispatched and inventory updated.' });
  } catch (err) { next(err); }
};

const cancelOrder = async (req, res, next) => {
  try {
    await salesOrderService.cancelOrder(req.params.id);
    res.status(200).json({ success: true, message: 'Order cancelled.' });
  } catch (err) { next(err); }
};

module.exports = { getAllSalesOrders, getSalesOrderById, confirmOrder, dispatchOrder, cancelOrder };
