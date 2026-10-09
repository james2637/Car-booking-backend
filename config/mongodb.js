import dns from "node:dns";
import mongoose from "mongoose";

const connectDB = async () => {
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected successfully!");
  });

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured.");
  }

  const mongoDnsServers = process.env.MONGO_DNS_SERVERS
    ?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (mongoDnsServers?.length) {
    dns.setServers(mongoDnsServers);
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DATABASE || "car-booking",
  });
};

export default connectDB;