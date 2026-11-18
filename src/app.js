import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import notFound from "./middlewares/notFound.js";
import errorHandler from "./middlewares/errorHandler.js";
import { UPLOADS_ROOT, serveUpload } from "./middlewares/upload.js";
import connectDB from "./config/db.js";
import ApiError from "./utils/ApiError.js";

const ensureDB = async (req, res, next) => {
  try {
    await connectDB();
  } catch {
    throw new ApiError(503, "Database is unavailable. Please try again shortly.");
  }
  next();
};

const app = express();

// Behind a reverse proxy (Nginx, a PaaS), set TRUST_PROXY=1 so rate limits see real client IPs.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Allowed browser origins: CLIENT_URL (website) plus any in CLIENT_URLS (comma-separated, e.g. the admin).
// With neither set, every origin is allowed, which is only meant for local development.
const allowedOrigins = [...new Set(
  [process.env.CLIENT_URL, ...(process.env.CLIENT_URLS || "").split(",")]
    .map((url) => url?.trim().replace(/\/$/, ""))
    .filter(Boolean)
)];
if (!allowedOrigins.length && process.env.NODE_ENV === "production") {
  console.warn("[cors] CLIENT_URL/CLIENT_URLS not set: the API accepts requests from any origin.");
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/", (req, res) => res.json({ success: true, name: "Al Hanna United Care API", health: "/api/health" }));
app.get("/api/health", (req, res) => res.json({ success: true, status: "ok" }));

app.use("/uploads", express.static(UPLOADS_ROOT, { maxAge: "7d" }));
app.get("/uploads/:id", ensureDB, serveUpload);

app.use("/api", ensureDB, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
