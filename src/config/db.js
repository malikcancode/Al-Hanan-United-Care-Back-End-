import mongoose from "mongoose";

let connecting = null;

// Reuses one connection per process. On serverless hosts (Vercel) each warm
// instance keeps it between requests; a failed attempt is retried next time.
const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!process.env.MONGO_URI) return Promise.reject(new Error("MONGO_URI is not set"));

  connecting ??= mongoose
    .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn.connection;
    })
    .catch((error) => {
      connecting = null;
      console.error(`MongoDB connection error: ${error.message}`);
      throw error;
    });

  return connecting;
};

export default connectDB;
