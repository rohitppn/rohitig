import { getThreadControl, upsertThreadControl } from "./sheets.js";

export async function getThreadState(threadId) {
  const control = await getThreadControl(threadId);

  if (!control) {
    return {
      threadId,
      muted: false,
      leadRowNumber: null,
      lead: {}
    };
  }

  let lead = {};
  try {
    lead = control.leadSnapshot ? JSON.parse(control.leadSnapshot) : {};
  } catch {
    lead = {};
  }

  return {
    threadId,
    muted: control.muted,
    leadRowNumber: control.leadRowNumber || null,
    lead
  };
}

export async function saveThreadState({
  threadId,
  instagramHandle,
  muted,
  leadRowNumber,
  lead
}) {
  await upsertThreadControl({
    threadId,
    instagramHandle,
    muted,
    leadRowNumber,
    leadSnapshot: lead,
    updatedAt: new Date().toISOString()
  });
}
