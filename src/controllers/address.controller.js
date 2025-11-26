const Address = require("../models/address.model");
const asyncHandler = require("../utils/asyncHandler");

const REQUIRED_FIELDS = ["name", "mobile", "address", "city", "state", "postal"];

function validateAddressPayload(body) {
  const missing = REQUIRED_FIELDS.filter((field) => !body[field]);
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(", ")}`;
  }
  return null;
}

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.user.id }).sort({ updatedAt: -1 });
  res.json({ success: true, data: addresses });
});

const createAddress = asyncHandler(async (req, res) => {
  const error = validateAddressPayload(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  const address = await Address.create({
    ...req.body,
    user: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Address saved successfully",
    data: address,
  });
});

const updateAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const error = validateAddressPayload(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  const updated = await Address.findOneAndUpdate(
    { _id: id, user: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updated) {
    return res.status(404).json({ success: false, message: "Address not found" });
  }

  res.json({
    success: true,
    message: "Address updated successfully",
    data: updated,
  });
});

const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Address.findOneAndDelete({ _id: id, user: req.user.id });
  if (!deleted) {
    return res.status(404).json({ success: false, message: "Address not found" });
  }

  res.json({
    success: true,
    message: "Address removed successfully",
  });
});

module.exports = {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
};


