import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { verifyMailer } from "./src/utils/mailer.js";

// Vercel imports this file and calls the exported app per request; it must not listen.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  try {
    await connectDB();
  } catch {
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
    // Check the SMTP login in the background; the API works either way.
    verifyMailer();
  });
}

export default app;
