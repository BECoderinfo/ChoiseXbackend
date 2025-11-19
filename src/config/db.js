const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI env variable");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUri, {
    dbName: mongoUri.split("/").pop(),
  });

  console.log("✅ MongoDB connected");
}

module.exports = { connectDB };

