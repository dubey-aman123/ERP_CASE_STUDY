'use strict';

const productService = require('../services/productService');

const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
};

const getAllProducts = async (req, res, next) => {
  try {
    const products = await productService.getAllProducts();
    res.status(200).json({ success: true, data: products });
  } catch (err) { next(err); }
};

const getInventory = async (req, res, next) => {
  try {
    const inventory = await productService.getInventory();
    res.status(200).json({ success: true, data: inventory });
  } catch (err) { next(err); }
};

const updateInventory = async (req, res, next) => {
  try {
    const inv = await productService.updateInventory(req.params.productId, req.body.physical_qty);
    res.status(200).json({ success: true, data: inv });
  } catch (err) { next(err); }
};

module.exports = { createProduct, getAllProducts, getInventory, updateInventory };
