import crypto from "crypto";

import { config } from "../config.js";

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function verifyMetaSignature(rawBody, signatureHeader) {
  if (!config.meta.appSecret) {
    return true;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.meta.appSecret)
    .update(rawBody)
    .digest("hex");

  const actual = signatureHeader.slice("sha256=".length);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function extractMessagingEvents(payload) {
  const events = [];

  for (const entry of payload?.entry || []) {
    if (Array.isArray(entry.messaging)) {
      for (const item of entry.messaging) {
        events.push({
          source: item?.message?.is_story_reply ? "story_reply" : "dm",
          senderId: safeText(item?.sender?.id),
          recipientId: safeText(item?.recipient?.id),
          messageText: safeText(item?.message?.text),
          messageId: safeText(item?.message?.mid),
          timestamp: item?.timestamp || Date.now(),
          isEcho: Boolean(item?.message?.is_echo)
        });
      }
    }

    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const incomingMessage = value?.messages?.[0];
      if (!incomingMessage?.text?.body) {
        continue;
      }

      events.push({
        source:
          incomingMessage?.context?.from?.is_mentioned_story_reply ||
          value?.story_mention?.id
            ? "story_reply"
            : "dm",
        senderId: safeText(value?.contacts?.[0]?.wa_id || incomingMessage?.from),
        recipientId: safeText(entry?.id),
        messageText: safeText(incomingMessage?.text?.body),
        messageId: safeText(incomingMessage?.id),
        timestamp: Number(incomingMessage?.timestamp || Date.now()),
        isEcho: false
      });
    }
  }

  return events.filter((event) => event.senderId && event.messageText);
}

export async function sendInstagramMessage({ recipientId, text }) {
  const url = `https://graph.facebook.com/${config.meta.apiVersion}/${config.meta.instagramAccountId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.meta.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Meta send failed: ${response.status} ${details}`);
  }

  return response.json();
}
