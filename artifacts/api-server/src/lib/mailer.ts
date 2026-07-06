import nodemailer from "nodemailer";
import { logger } from "./logger";

interface SmtpConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: "none" | "ssl" | "tls";
}

const transportCache = new Map<string, nodemailer.Transporter>();

export function createTransport(cfg: SmtpConfig) {
  // Port 465 almost always requires direct SSL/TLS (implicit TLS), which maps to secure: true.
  // We automatically enable secure mode if port is 465 and encryption is not explicitly set to "none".
  const secure = cfg.encryption === "ssl" || (cfg.port === 465 && cfg.encryption !== "none");
  const requireTls = cfg.encryption === "tls" && cfg.port !== 465;

  return nodemailer.createTransport({
    pool: true,
    maxConnections: 10, // Up to 10 concurrent connections
    maxMessages: 100,    // Reuse connection for up to 100 messages
    host: cfg.host,
    port: cfg.port,
    secure,
    requireTLS: requireTls,
    auth: { user: cfg.username, pass: cfg.password },
    tls: { rejectUnauthorized: false },
  });
}

export function getTransport(cfg: SmtpConfig): nodemailer.Transporter {
  const cacheKey = `${cfg.id}-${cfg.host}-${cfg.port}-${cfg.username}`;
  let transport = transportCache.get(cacheKey);
  if (!transport) {
    transport = createTransport(cfg);
    transportCache.set(cacheKey, transport);
  }
  return transport;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(
  cfg: SmtpConfig,
  opts: {
    to: string;
    subject: string;
    html: string;
    from: string;
  },
): Promise<SendResult> {
  try {
    const transport = getTransport(cfg);
    const info = await transport.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, to: opts.to }, "Failed to send email");
    return { success: false, error: msg };
  }
}
