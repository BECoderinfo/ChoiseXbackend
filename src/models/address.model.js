const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    area: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postal: { type: String, required: true },
  },
  { timestamps: true }
);

addressSchema.index({ user: 1 });

module.exports = mongoose.model("Address", addressSchema);


