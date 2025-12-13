const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const { getUsersAdmin } = require("../controllers/adminUser.controller");

// Admin-only
router.use(authenticate, (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
});

router.get("/", getUsersAdmin);

module.exports = router;

