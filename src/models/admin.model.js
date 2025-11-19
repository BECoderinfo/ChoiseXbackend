const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    otpHash: { type: String },
    otpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", AdminSchema);


