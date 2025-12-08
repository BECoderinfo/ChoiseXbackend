const express = require("express");
const { createSubcategory, getSubcategories, updateSubcategory, deleteSubcategory } = require("../controllers/subcategory.controller");
const upload = require("../middleware/upload");
const authenticate = require("../middleware/auth");

const router = express.Router();
const uploadSingle = upload.single("image");

router.use(authenticate);

router.get("/", getSubcategories);
router.post("/", uploadSingle, createSubcategory);
router.put("/:id", uploadSingle, updateSubcategory);
router.delete("/:id", deleteSubcategory);

module.exports = router;


