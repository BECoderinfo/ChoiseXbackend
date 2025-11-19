const express = require("express");
const { createCategory, getCategories, updateCategory, deleteCategory } = require("../controllers/category.controller");
const authenticate = require("../middleware/auth");

const router = express.Router();

// Apply authentication middleware to all category routes
router.use(authenticate);

router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;

