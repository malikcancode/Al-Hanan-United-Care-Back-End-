import rateLimit from "express-rate-limit";

// Per-IP limits. In-memory store: fine for one API instance; use a shared store
// (e.g. rate-limit-redis) if the API is ever run on several servers.
// Behind a proxy, set TRUST_PROXY=1 so limits see the real visitor IP (see app.js).
const limiter = ({ windowMinutes, limit, message }) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, message }),
  });

const num = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);

// Public form endpoints: default 5 submissions per 15 minutes per IP.
const FORM_WINDOW = num(process.env.FORM_RATE_WINDOW_MINUTES, 15);
const FORM_LIMIT = num(process.env.FORM_RATE_LIMIT, 5);

export const bookingLimiter = limiter({
  windowMinutes: FORM_WINDOW,
  limit: FORM_LIMIT,
  message: "Too many booking requests from this device. Please wait a few minutes, or call or WhatsApp the clinic.",
});

export const messageLimiter = limiter({
  windowMinutes: FORM_WINDOW,
  limit: FORM_LIMIT,
  message: "Too many messages from this device. Please wait a few minutes, or call or WhatsApp the clinic.",
});

export const loginLimiter = limiter({
  windowMinutes: 15,
  limit: 10,
  message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
});
