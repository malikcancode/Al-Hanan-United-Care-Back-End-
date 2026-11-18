import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { verifyMailer } from "./src/utils/mailer.js";

const PORT = process.env.PORT || 5000;

await connectDB();

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  // Check the SMTP login in the background; the API works either way.
  verifyMailer();
});
