import nodemailer from "nodemailer";

// GoDaddy "Professional Email powered by Titan" mailbox. All settings come from env
// (loaded by `import "dotenv/config"` in server.js / test-smtp.js before this is used):
//   SMTP_HOST=smtpout.secureserver.net  SMTP_PORT=465 (SSL) or 587 / 3535 (STARTTLS)
//   SMTP_USER=hr@alhannaunitedcare.site  SMTP_PASS=...  MAIL_TO=hr@alhannaunitedcare.site
//   SMTP_DEBUG=true  -> logs the full SMTP conversation (password is masked by nodemailer)
export const DEFAULT_SMTP_HOST = "smtpout.secureserver.net";
export const DEFAULT_SMTP_PORT = 465;

const fromName = () => process.env.MAIL_FROM_NAME || "Al Hanna Website";
export const smtpDebugEnabled = () => String(process.env.SMTP_DEBUG).toLowerCase() === "true";

let transporter = null;

export const isMailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_TO);

// The one place the SMTP connection is configured; test-smtp.js uses it too.
export const createSmtpTransport = ({ host, port } = {}) => {
  const smtpHost = host || process.env.SMTP_HOST || DEFAULT_SMTP_HOST;
  const smtpPort = Number(port || process.env.SMTP_PORT) || DEFAULT_SMTP_PORT;
  const secure = smtpPort === 465; // 465 = TLS from the start; 587/3535 = plain then STARTTLS
  const debug = smtpDebugEnabled();

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    ...(!secure && { requireTLS: true }),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { servername: smtpHost, minVersion: "TLSv1.2" },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    logger: debug,
    debug,
  });
};

export const describeTransport = (t) => {
  const o = t.options;
  return `${o.host}:${o.port} (${o.secure ? "SSL/TLS" : "STARTTLS"})`;
};

const getTransporter = () => {
  if (!transporter) transporter = createSmtpTransport();
  return transporter;
};

// Explains the usual GoDaddy/Titan failures in plain words.
export const explainSmtpError = (err) => {
  const msg = `${err?.code || ""} ${err?.responseCode || ""} ${err?.message || ""}`;
  if (/EAUTH|535|Invalid login|authentication/i.test(msg)) {
    return "Login rejected: wrong password, or the wrong server for this mailbox. For GoDaddy Titan mailboxes use SMTP_HOST=smtpout.secureserver.net with the webmail password.";
  }
  if (/ECONNRESET/i.test(msg)) {
    return "The connection was dropped during the TLS handshake. Antivirus mail/SSL scanning (e.g. Avast, Kaspersky, ESET 'scan email') or the network is usually the cause. Turn that scanning off, or try another network such as a mobile hotspot.";
  }
  if (/ETIMEDOUT|ETIMEOUT|timeout|ESOCKET|ECONNREFUSED/i.test(msg)) {
    return "No answer on this port: it is probably blocked by the network or ISP. Try another port (465, 587, 3535) or another network.";
  }
  if (/ENOTFOUND|EDNS/i.test(msg)) return "The SMTP host name could not be found. Check SMTP_HOST.";
  if (/certificate|self.signed|TLS|SSL|wrong version/i.test(msg)) {
    return "TLS problem. Use port 465 with SSL, or 587/3535 with STARTTLS (this is set automatically from SMTP_PORT).";
  }
  return "";
};

// Called once at startup: logs whether email is ready, never stops the server.
export const verifyMailer = async () => {
  if (!isMailConfigured()) {
    console.warn("[mail] SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_TO). Submissions are saved but no emails are sent.");
    return false;
  }
  try {
    await getTransporter().verify();
    console.log(`[mail] SMTP ready: ${process.env.SMTP_USER} via ${describeTransport(getTransporter())}`);
    return true;
  } catch (err) {
    const hint = explainSmtpError(err);
    console.error(`[mail] SMTP verify failed: ${err.message}${hint ? `\n[mail] ${hint}` : ""}`);
    return false;
  }
};

// ---------- Email building ----------

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Strip line breaks so user input can never inject extra mail headers via the subject.
const oneLine = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();

const buildHtml = (title, rows, footer) => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#11262a">
  <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e1e7e6;border-radius:12px;border-collapse:separate;overflow:hidden">
    <tr><td style="background:#0a3431;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">${escapeHtml(title)}</td></tr>
    <tr><td style="padding:8px 24px 4px">
      <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;line-height:1.5">
        ${rows
          .map(
            ([label, value]) => `<tr>
          <td style="padding:10px 12px 10px 0;border-bottom:1px solid #e1e7e6;color:#566a6d;width:150px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e1e7e6;vertical-align:top;white-space:pre-wrap;word-break:break-word">${escapeHtml(value || "—")}</td>
        </tr>`
          )
          .join("")}
      </table>
    </td></tr>
    <tr><td style="padding:16px 24px 22px;font-size:12px;color:#566a6d">${escapeHtml(footer)}</td></tr>
  </table>
</body></html>`;

const buildText = (title, rows, footer) =>
  `${title}\n${"=".repeat(title.length)}\n\n${rows.map(([l, v]) => `${l}: ${v || "—"}`).join("\n")}\n\n${footer}\n`;

const send = async ({ subject, title, rows, replyTo }) => {
  const footer = `Sent automatically from the Al Hanna United Care website${
    process.env.ADMIN_URL ? ` · Manage it in the admin: ${process.env.ADMIN_URL}` : ""
  }.`;
  return getTransporter().sendMail({
    from: { name: fromName(), address: process.env.SMTP_USER },
    to: process.env.MAIL_TO,
    ...(replyTo && { replyTo }),
    subject: oneLine(subject),
    text: buildText(title, rows, footer),
    html: buildHtml(title, rows, footer),
  });
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
const fmtStamp = (d) =>
  new Date(d || Date.now()).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.MAIL_TIMEZONE || "Asia/Dubai" });

const TOPIC_LABELS = {
  general: "General question",
  appointment: "An existing appointment",
  prescription: "Prescription or refill",
  reports: "Lab results or reports",
  other: "Something else",
};

export const sendContactEmail = (msg) => {
  const topic = TOPIC_LABELS[msg.topic] || msg.topic || "";
  return send({
    subject: `📩 New Message: ${msg.subject || topic || msg.fullName}`,
    title: "New contact message",
    replyTo: msg.email ? { name: oneLine(msg.fullName), address: msg.email } : undefined,
    rows: [
      ["Name", msg.fullName],
      ["Phone / WhatsApp", msg.phone],
      ["Email", msg.email],
      ["Topic", topic],
      ["Message", msg.message],
      ["Received", fmtStamp(msg.createdAt)],
    ],
  });
};

export const sendAppointmentEmail = (appt, { serviceTitle } = {}) => {
  const date = fmtDate(appt.preferredDate);
  const when = appt.time ? `${date} ${appt.time}` : `${date}, time to be confirmed`;
  return send({
    subject: `📅 New Appointment: ${appt.fullName} (${when})`,
    title: "New appointment request",
    rows: [
      ["Name", appt.fullName],
      ["Phone / WhatsApp", appt.phone],
      ["Service", serviceTitle],
      ["Preferred date", date],
      ["Time", appt.time || "To be confirmed with the patient"],
      ["Status", appt.status],
      ["Received", fmtStamp(appt.createdAt)],
    ],
  });
};

// Sends in the background and records the outcome on the saved document.
// The visitor's request never waits for, or fails because of, email.
export const notifyInBackground = (doc, sender, label) => {
  if (!isMailConfigured()) return;
  sender()
    .then((info) => {
      doc.constructor
        .updateOne({ _id: doc._id }, { $set: { emailNotification: { sent: true, at: new Date(), messageId: info.messageId } } })
        .catch(() => {});
    })
    .catch((err) => {
      const hint = explainSmtpError(err);
      console.error(`[mail] ${label} email failed for ${doc._id}: ${err.message}${hint ? ` | ${hint}` : ""}`);
      doc.constructor
        .updateOne({ _id: doc._id }, { $set: { emailNotification: { sent: false, at: new Date(), error: err.message.slice(0, 300) } } })
        .catch(() => {});
    });
};
