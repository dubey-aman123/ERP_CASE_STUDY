'use strict';

const enquiryService = require('../services/enquiryService');

const createEnquiry = async (req, res, next) => {
  try {
    const enquiry = await enquiryService.createEnquiry(req.body, req.user.id);
    res.status(201).json({ success: true, data: enquiry });
  } catch (err) { next(err); }
};

const getAllEnquiries = async (req, res, next) => {
  try {
    const enquiries = await enquiryService.getAllEnquiries();
    res.status(200).json({ success: true, data: enquiries });
  } catch (err) { next(err); }
};

const getEnquiryById = async (req, res, next) => {
  try {
    const enquiry = await enquiryService.getEnquiryById(req.params.id);
    res.status(200).json({ success: true, data: enquiry });
  } catch (err) { next(err); }
};

module.exports = { createEnquiry, getAllEnquiries, getEnquiryById };
