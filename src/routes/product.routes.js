const express = require("express");
const { createProduct, getProducts, getProduct, updateProduct, deleteProduct } = require("../controllers/product.controller");
const upload = require("../middleware/upload");
const authenticate = require("../middleware/auth");

const router = express.Router();
const uploadFields = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "gallery", maxCount: 4 },
]);

// Apply authentication middleware to all product routes
router.use(authenticate);

router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/", uploadFields, createProduct);
router.put("/:id", uploadFields, updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;

