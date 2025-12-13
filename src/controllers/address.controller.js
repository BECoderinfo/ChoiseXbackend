const Address = require("../models/address.model");
const User = require("../models/user.model");
const asyncHandler = require("../utils/asyncHandler");

// Only address-location fields are user-editable. Identity fields are forced from the user profile.
const REQUIRED_FIELDS = ["address", "city", "state", "postal"];

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

  // Fetch user profile to lock identity fields
  const user = await User.findById(req.user.id).select("name email phone");
  if (!user) {
    return res.status(401).json({ success: false, message: "User not found. Please login again." });
  }

  // Enforce address limit (max 3 per user)
  const existingCount = await Address.countDocuments({ user: req.user.id });
  if (existingCount >= 3) {
    return res
      .status(400)
      .json({ success: false, message: "You can save up to 3 delivery addresses only." });
  }

  // Lock identity fields to the logged-in user
  const address = await Address.create({
    address: req.body.address,
    area: req.body.area,
    city: req.body.city,
    state: req.body.state,
    postal: req.body.postal,
    name: user.name,
    mobile: user.phone || "",
    email: user.email,
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

  const user = await User.findById(req.user.id).select("name email phone");
  if (!user) {
    return res.status(401).json({ success: false, message: "User not found. Please login again." });
  }

  // Only allow updates to location fields; identity remains locked to user profile
  const payload = {
    address: req.body.address,
    area: req.body.area,
    city: req.body.city,
    state: req.body.state,
    postal: req.body.postal,
    name: user.name,
    mobile: user.phone || "",
    email: user.email,
  };

  const updated = await Address.findOneAndUpdate(
    { _id: id, user: req.user.id },
    payload,
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


