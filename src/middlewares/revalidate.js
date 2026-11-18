// After a successful admin change, ask the website to drop its cached copy
// of that data so visitors see the update straight away.
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const notifyFrontend = async (tag) => {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.warn(`[revalidate] REVALIDATE_SECRET is not set; website cache for "${tag}" was not refreshed.`);
    return;
  }
  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tag }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[revalidate] website responded ${res.status} for "${tag}"`);
  } catch (err) {
    console.warn(`[revalidate] could not reach the website for "${tag}": ${err.message}`);
  }
};

const revalidateOn = (tag) => (req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400) notifyFrontend(tag);
    });
  }
  next();
};

export default revalidateOn;
