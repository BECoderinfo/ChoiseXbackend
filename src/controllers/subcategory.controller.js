const Subcategory = require("../models/subcategory.model");
const Category = require("../models/category.model");
const asyncHandler = require("../utils/asyncHandler");

function buildFilePath(file) {
  if (!file) return null;
  return `/uploads/${file.filename}`;
}

const createSubcategory = asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  const imageFile = req.file;

  if (!name) {
    return res.status(400).json({ success: false, message: "Subcategory name is required" });
  }

  if (!imageFile) {
    return res.status(400).json({ success: false, message: "Subcategory image is required" });
  }

  if (category) {
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
  }

  const duplicate = await Subcategory.findOne({ name: name.trim(), category: category || null });
  if (duplicate) {
    return res.status(400).json({ success: false, message: "Subcategory already exists" });
  }

  const subcategory = await Subcategory.create({
    name: name.trim(),
    category: category || undefined,
    image: buildFilePath(imageFile),
  });

  res.status(201).json({ success: true, data: subcategory });
});

const getSubcategories = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = category ? { category } : {};

  const subcategories = await Subcategory.find(filter)
    .populate("category", "name")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: subcategories });
});

const updateSubcategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, category } = req.body;
  const imageFile = req.file;

  const subcategory = await Subcategory.findById(id);
  if (!subcategory) {
    return res.status(404).json({ success: false, message: "Subcategory not found" });
  }

  if (category) {
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    subcategory.category = category;
  } else if (category === "") {
    subcategory.category = undefined;
  }

  if (name) {
    const duplicate = await Subcategory.findOne({ _id: { $ne: id }, name: name.trim(), category: subcategory.category || null });
    if (duplicate) {
      return res.status(400).json({ success: false, message: "Subcategory already exists" });
    }
    subcategory.name = name.trim();
  }

 

  if (imageFile) {
    subcategory.image = buildFilePath(imageFile);
  }

  await subcategory.save();
  res.json({ success: true, data: subcategory });
});

const deleteSubcategory = asyncHandler(async (req, res) => {
  const deleted = await Subcategory.findByIdAndDelete(req.params.id);

  if (!deleted) {
    return res.status(404).json({ success: false, message: "Subcategory not found" });
  }

  res.json({ success: true, message: "Subcategory deleted" });
});

module.exports = { createSubcategory, getSubcategories, updateSubcategory, deleteSubcategory };


