import nodemailer from "nodemailer";

const hasMailConfig =
  Boolean(process.env.MAIL_HOST) &&
  Boolean(process.env.MAIL_USER) &&
  Boolean(process.env.MAIL_PASS);

const parsePort = (value) => {
  const port = Number(value);
  return Number.isFinite(port) ? port : 587;
};

const createTransporter = () => {
  if (!hasMailConfig) return null;
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parsePort(process.env.MAIL_PORT),
    secure: (process.env.MAIL_SECURE || "").toLowerCase() === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
};

const transporter = createTransporter();

export const sendMail = async (mailOptions) => {
  if (!transporter) {
    throw new Error(
      "Email transporter is not configured. Please provide MAIL_HOST, MAIL_USER, and MAIL_PASS."
    );
  }

  const finalOptions = {
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    ...mailOptions,
  };

  return transporter.sendMail(finalOptions);
};
