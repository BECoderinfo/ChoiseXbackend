require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./config/db");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

const uploadsPath = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsPath));

app.get("/api/health", (_, res) => {
  res.json({ success: true, message: "API is running Enjoy your day 🎉🎉🎉" });
});

app.use("/api", routes);

app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server ready on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });

