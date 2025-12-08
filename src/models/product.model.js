const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    star: { type: Number, min: 1, max: 5, default: 5 },
    review: { type: String, trim: true },
    username: { type: String, trim: true },
    userimage: { type: String, trim: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    markprice: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" },
    availability: { type: Number, default: 0 },
    material: { type: String, trim: true },
    feature: { type: String, trim: true },
    waterproof: { type: String, enum: ["Yes", "No"], default: "Yes" },
    rechargeable: { type: String, enum: ["Yes", "No"], default: "Yes" },
    description: { type: String, trim: true },
    mainImage: { type: String, required: true },
    galleryImages: [{ type: String }],
    customerrating: [reviewSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);

