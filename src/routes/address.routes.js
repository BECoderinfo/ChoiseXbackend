const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/userAuth");
const {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} = require("../controllers/address.controller");

router.use(authenticateUser);

router.get("/", getAddresses);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);

module.exports = router;


