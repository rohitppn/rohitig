import dotenv from "dotenv";

dotenv.config();

const required = [
  "META_VERIFY_TOKEN",
  "META_ACCESS_TOKEN",
  "INSTAGRAM_ACCOUNT_ID",
  "OPENAI_API_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY"
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[config] Missing required env var: ${key}`);
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  baseUrl: process.env.BASE_URL || "",
  meta: {
    appSecret: process.env.META_APP_SECRET || "",
    verifyToken: process.env.META_VERIFY_TOKEN || "",
    accessToken: process.env.META_ACCESS_TOKEN || "",
    apiVersion: process.env.META_API_VERSION || "v23.0",
    instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID || "",
    instagramUsername: process.env.INSTAGRAM_BUSINESS_USERNAME || "rohittkrsharma",
    ownerInstagramId: process.env.BOT_OWNER_IG_ID || ""
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-5-mini"
  },
  sheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
    leadsSheetName: process.env.GOOGLE_SHEETS_LEADS_SHEET || "Sheet1",
    threadControlSheetName:
      process.env.GOOGLE_SHEETS_THREAD_CONTROL_SHEET || "ThreadControl",
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
  }
};
