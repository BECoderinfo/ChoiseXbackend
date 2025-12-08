const mongoose = require("mongoose");

const subcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    image: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  },
  { timestamps: true }
);

subcategorySchema.index({ name: 1, category: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Subcategory", subcategorySchema);


