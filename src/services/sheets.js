import { google } from "googleapis";

import { config } from "../config.js";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const auth = new google.auth.JWT(
  config.sheets.serviceAccountEmail,
  null,
  config.sheets.privateKey,
  SCOPES
);

const sheets = google.sheets({ version: "v4", auth });

const LEADS_HEADERS = [
  "Name",
  "Instagram handle",
  "Phone / email",
  "Interest",
  "Budget",
  "Location",
  "Source",
  "Conversation summary",
  "Lead status",
  "Last contact date"
];

const THREAD_CONTROL_HEADERS = [
  "Thread ID",
  "Instagram handle",
  "Muted",
  "Lead row number",
  "Lead snapshot",
  "Updated at"
];

async function getSpreadsheet() {
  return sheets.spreadsheets.get({
    spreadsheetId: config.sheets.spreadsheetId
  });
}

async function ensureSheetExists(title, headers) {
  const spreadsheet = await getSpreadsheet();
  const existing = spreadsheet.data.sheets?.find(
    (sheet) => sheet.properties?.title === title
  );

  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheets.spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }]
      }
    });
  }

  const currentHeaders = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${title}!1:1`
  });

  if (!currentHeaders.data.values?.[0]?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheets.spreadsheetId,
      range: `${title}!1:1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers]
      }
    });
  }
}

async function getSheetRows(sheetName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${sheetName}!A:Z`
  });

  return response.data.values || [];
}

function normalizeCell(value) {
  return typeof value === "string" ? value : "";
}

function rowHasLeadData(row) {
  return row.some((cell) => normalizeCell(cell).trim() !== "");
}

export async function initializeSheets() {
  await ensureSheetExists(config.sheets.leadsSheetName, LEADS_HEADERS);
  await ensureSheetExists(
    config.sheets.threadControlSheetName,
    THREAD_CONTROL_HEADERS
  );
}

export async function getThreadControl(threadId) {
  const rows = await getSheetRows(config.sheets.threadControlSheetName);

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (normalizeCell(row[0]) === threadId) {
      return {
        rowNumber: index + 1,
        threadId: normalizeCell(row[0]),
        instagramHandle: normalizeCell(row[1]),
        muted: normalizeCell(row[2]).toLowerCase() === "true",
        leadRowNumber: normalizeCell(row[3]),
        leadSnapshot: normalizeCell(row[4]),
        updatedAt: normalizeCell(row[5])
      };
    }
  }

  return null;
}

export async function upsertThreadControl({
  threadId,
  instagramHandle,
  muted,
  leadRowNumber,
  leadSnapshot,
  updatedAt
}) {
  const existing = await getThreadControl(threadId);
  const values = [
    [
      threadId,
      instagramHandle,
      String(Boolean(muted)),
      leadRowNumber ? String(leadRowNumber) : "",
      leadSnapshot ? JSON.stringify(leadSnapshot) : "",
      updatedAt
    ]
  ];

  if (existing?.rowNumber) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheets.spreadsheetId,
      range: `${config.sheets.threadControlSheetName}!A${existing.rowNumber}:F${existing.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values }
    });
    return existing.rowNumber;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.threadControlSheetName}!A:F`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values }
  });

  const refreshed = await getThreadControl(threadId);
  return refreshed?.rowNumber || null;
}

export async function upsertLead({
  threadId,
  instagramHandle,
  lead,
  source,
  conversationSummary,
  leadStatus,
  lastContactDate
}) {
  const control = await getThreadControl(threadId);
  const existingRowNumber = Number(control?.leadRowNumber || 0);

  const rowValues = [
    lead.name || "",
    instagramHandle || "",
    lead.phoneOrEmail || "",
    lead.interest || "",
    lead.budget || "",
    lead.location || "",
    source || "",
    conversationSummary || "",
    leadStatus || "collecting_details",
    lastContactDate || ""
  ];

  if (existingRowNumber > 1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheets.spreadsheetId,
      range: `${config.sheets.leadsSheetName}!A${existingRowNumber}:J${existingRowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues]
      }
    });
    return existingRowNumber;
  }

  const rows = await getSheetRows(config.sheets.leadsSheetName);
  let appendAt = rows.length + 1;

  if (rows.length === 1 && !rowHasLeadData(rows[0])) {
    appendAt = 2;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.leadsSheetName}!A${appendAt}:J${appendAt}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [rowValues]
    }
  });

  return appendAt;
}
