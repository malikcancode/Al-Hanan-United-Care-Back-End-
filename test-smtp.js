// Sends one test email using the SMTP settings in .env.
//   node test-smtp.js
//   $env:SMTP_DEBUG="true"; node test-smtp.js     (PowerShell, full SMTP log)
// If SMTP_PORT is not set, tries 465, then 587, then 3535 and stops at the first that works.
import "dotenv/config"; // must be first: loads .env before the transporter is created
import fs from "node:fs";
import { createSmtpTransport, describeTransport, explainSmtpError, DEFAULT_SMTP_HOST } from "./src/utils/mailer.js";

const FALLBACK_PORTS = [465, 587, 3535];

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;
const fromName = process.env.MAIL_FROM_NAME || "Al Hanna Website";

const missing = Object.entries({ SMTP_USER, SMTP_PASS, MAIL_TO })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`✘ Missing in .env: ${missing.join(", ")}`);
  process.exit(1);
}

// Password sanity checks, without ever printing the password.
try {
  const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find((l) => /^\s*SMTP_PASS\s*=/.test(l)) || "";
  const raw = line.replace(/^\s*SMTP_PASS\s*=\s*/, "");
  const quoted = /^(["']).*\1\s*$/.test(raw);
  if (/^[“”‘’]|[“”‘’]\s*$/.test(raw)) console.warn("⚠ SMTP_PASS uses curly quotes “ ”. Replace them with straight quotes \" \".");
  if (!quoted && raw.includes("#")) console.warn('⚠ SMTP_PASS contains "#" without quotes, so it is cut off. Wrap it: SMTP_PASS="..."');
  if (!quoted && raw !== raw.trim()) console.warn("⚠ SMTP_PASS has spaces around it in .env.");
} catch {
  /* values came from the real environment */
}

const host = SMTP_HOST || DEFAULT_SMTP_HOST;
const ports = SMTP_PORT ? [Number(SMTP_PORT)] : FALLBACK_PORTS;

console.log(`User:     ${SMTP_USER}`);
console.log(`Password: ${SMTP_PASS.length} characters (not shown)`);
console.log(`Send to:  ${MAIL_TO}`);
console.log(`Debug:    ${String(process.env.SMTP_DEBUG).toLowerCase() === "true" ? "on" : "off (set SMTP_DEBUG=true for the full SMTP log)"}`);
if (!SMTP_PORT) console.log(`SMTP_PORT not set: will try ${FALLBACK_PORTS.join(", ")}`);

const printError = (err) => {
  console.error(`  code:     ${err.code ?? "-"}`);
  console.error(`  command:  ${err.command ?? "-"}`);
  console.error(`  response: ${err.response ?? "-"}`);
  console.error(`  message:  ${err.message}`);
  const hint = explainSmtpError(err);
  if (hint) console.error(`  hint:     ${hint}`);
};

let lastError = null;
for (const port of ports) {
  const transporter = createSmtpTransport({ host, port });
  console.log(`\n→ ${describeTransport(transporter)} ...`);

  try {
    await transporter.verify();
    console.log("  ✔ Connected and logged in");

    const info = await transporter.sendMail({
      from: `"${fromName.replace(/"/g, "")}" <${SMTP_USER}>`,
      to: MAIL_TO,
      subject: "✅ SMTP test from the Al Hanna website",
      text: `If you can read this in ${MAIL_TO}, website emails are working.\n\nServer: ${describeTransport(transporter)}\nSent ${new Date().toISOString()}`,
      html: `<p>If you can read this in <b>${MAIL_TO}</b>, website emails are working.</p><p style="color:#666">Server: ${describeTransport(transporter)}<br>Sent ${new Date().toISOString()}</p>`,
    });

    console.log(`  ✔ Test email sent to ${MAIL_TO} (message id ${info.messageId})`);
    console.log(`\nWORKING SETTINGS: SMTP_HOST=${host}  SMTP_PORT=${port}`);
    if (!SMTP_PORT) console.log(`Add SMTP_PORT=${port} to .env so the app uses this port.`);
    console.log("Check the inbox (and Spam) at https://secureserver.titan.email");
    transporter.close();
    process.exit(0);
  } catch (err) {
    lastError = err;
    console.error("  ✘ Failed");
    printError(err);
    transporter.close();
    // A wrong password fails the same way on every port: stop instead of risking a lockout.
    if (err.code === "EAUTH" || err.responseCode === 535) break;
  }
}

console.error(`\n✘ No working SMTP connection${lastError?.code === "EAUTH" ? " (login rejected)" : ""}.`);
process.exit(1);
