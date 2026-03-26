import express from "express";

import { config } from "./config.js";
import { generateLeadReply } from "./services/openai.js";
import {
  extractMessagingEvents,
  sendInstagramMessage,
  verifyMetaSignature
} from "./services/meta.js";
import {
  areSheetsReady,
  initializeSheets,
  upsertLead
} from "./services/sheets.js";
import { getThreadState, saveThreadState } from "./services/state.js";

const app = express();

app.use(
  express.json({
    verify(req, _res, buffer) {
      req.rawBody = buffer;
    }
  })
);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "instagram-lead-bot",
    instagram: config.meta.instagramUsername
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    sheetsReady: areSheetsReady()
  });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.meta.verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  const signature = req.get("x-hub-signature-256");
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

  if (!verifyMetaSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  res.status(200).json({ received: true });

  const events = extractMessagingEvents(req.body);
  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error("[webhook] Failed to handle event", error);
    }
  }
});

app.post("/test/reply", async (req, res) => {
  const messageText = String(req.body?.messageText || "hi");
  const senderId = String(req.body?.senderId || "test-user");
  const instagramHandle = String(req.body?.instagramHandle || "test_user");
  const source = String(req.body?.source || "dm");

  const result = await buildReplyForMessage({
    senderId,
    instagramHandle,
    messageText,
    source
  });

  res.json(result);
});

async function handleEvent(event) {
  const participantIds = [event.senderId, event.recipientId].filter(Boolean);
  if (!participantIds.length) {
    return;
  }

  const ownerIds = new Set(
    [config.meta.ownerInstagramId, config.meta.instagramAccountId].filter(Boolean)
  );
  const ownerSentMessage =
    event.isEcho ||
    participantIds.some((participantId) => ownerIds.has(participantId)) &&
      ownerIds.has(event.senderId);
  const customerThreadId = ownerSentMessage ? event.recipientId : event.senderId;

  if (!customerThreadId) {
    return;
  }

  const instagramHandle = `ig_${customerThreadId}`;
  const result = await buildReplyForMessage({
    senderId: customerThreadId,
    instagramHandle,
    messageText: event.messageText,
    source: event.source,
    ownerSentMessage
  });

  if (result.shouldReply && result.reply) {
    await sendInstagramMessage({
      recipientId: customerThreadId,
      text: result.reply
    });
  }
}

function mergeLead(currentLead, nextLead) {
  return {
    name: nextLead.name || currentLead.name || "",
    phoneOrEmail: nextLead.phoneOrEmail || currentLead.phoneOrEmail || "",
    interest: nextLead.interest || currentLead.interest || "",
    budget: nextLead.budget || currentLead.budget || "",
    location: nextLead.location || currentLead.location || ""
  };
}

async function buildReplyForMessage({
  senderId,
  instagramHandle,
  messageText,
  source,
  ownerSentMessage = false
}) {
  const trimmedMessage = messageText.trim();
  const lowerMessage = trimmedMessage.toLowerCase();
  const threadState = await getThreadState(senderId);
  const today = new Date().toISOString();

  if (threadState.muted) {
    return {
      reply: "",
      shouldReply: false,
      leadStatus: "collecting_details",
      muted: true
    };
  }

  if (ownerSentMessage && (lowerMessage === ".." || lowerMessage === "stop")) {
    await saveThreadState({
      threadId: senderId,
      instagramHandle,
      muted: true,
      leadRowNumber: threadState.leadRowNumber,
      lead: threadState.lead
    });

    return {
      reply: "",
      shouldReply: false,
      leadStatus: "collecting_details",
      muted: true
    };
  }

  const aiResult = await generateLeadReply({
    threadState,
    customerMessage: trimmedMessage,
    customerProfile: {
      instagramHandle
    },
    source,
    today
  });

  const mergedLead = mergeLead(threadState.lead, aiResult.lead);
  const lastContactDate = new Date().toISOString();

  const leadRowNumber = await upsertLead({
    threadId: senderId,
    instagramHandle,
    lead: mergedLead,
    source,
    conversationSummary: aiResult.conversationSummary,
    leadStatus: aiResult.leadStatus,
    lastContactDate
  });

  await saveThreadState({
    threadId: senderId,
    instagramHandle,
    muted: aiResult.shouldMuteThread,
    leadRowNumber,
    lead: mergedLead
  });

  return {
    reply: aiResult.reply,
    shouldReply: aiResult.shouldReply,
    leadStatus: aiResult.leadStatus,
    muted: aiResult.shouldMuteThread,
    lead: mergedLead,
    leadRowNumber
  };
}

async function start() {
  app.listen(config.port, () => {
    console.log(
      `[server] Listening on port ${config.port} for ${config.meta.instagramUsername}`
    );
  });

  initializeSheets()
    .then(() => {
      console.log("[server] Google Sheets initialized");
    })
    .catch((error) => {
      console.error("[server] Google Sheets initialization failed", error);
    });
}

start().catch((error) => {
  console.error("[server] Failed to start", error);
  process.exit(1);
});
