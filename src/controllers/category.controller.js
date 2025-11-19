const Category = require("../models/category.model");
const asyncHandler = require("../utils/asyncHandler");

const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: "Category name is required" });
  }

  const category = await Category.create({ name: name.trim() });
  res.status(201).json({ success: true, data: category });
});

const getCategories = asyncHandler(async (_, res) => {
  const categories = await Category.find().sort({ createdAt: -1 });
  res.json({ success: true, data: categories });
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const updated = await Category.findByIdAndUpdate(id, { name }, { new: true, runValidators: true });

  if (!updated) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }

  res.json({ success: true, data: updated });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Category.findByIdAndDelete(id);

  if (!deleted) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }

  res.json({ success: true, message: "Category deleted" });
});

module.exports = { createCategory, getCategories, updateCategory, deleteCategory };

