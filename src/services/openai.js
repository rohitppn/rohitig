import OpenAI from "openai";

import { config } from "../config.js";
import { buildSystemPrompt, buildUserPrompt } from "../prompt.js";

const client = new OpenAI({
  apiKey: config.openai.apiKey
});

function normalizeModelOutput(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function generateLeadReply(context) {
  const response = await client.responses.create({
    model: config.openai.model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: buildSystemPrompt() }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: buildUserPrompt(context) }]
      }
    ],
    temperature: 0.8
  });

  const text = response.output_text || "";
  const parsed = JSON.parse(normalizeModelOutput(text));

  return {
    reply: typeof parsed.reply === "string" ? parsed.reply.trim() : "",
    lead: {
      name: parsed?.lead?.name || "",
      phoneOrEmail: parsed?.lead?.phoneOrEmail || "",
      interest: parsed?.lead?.interest || "",
      budget: parsed?.lead?.budget || "",
      location: parsed?.lead?.location || ""
    },
    leadStatus: parsed.leadStatus || "collecting_details",
    conversationSummary: parsed.conversationSummary || "",
    shouldReply: Boolean(parsed.shouldReply),
    shouldMuteThread: Boolean(parsed.shouldMuteThread),
    confirmationPending: Boolean(parsed.confirmationPending)
  };
}
