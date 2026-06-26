// Pattern library for the agent-studio onboarding pattern picker.
//
// The canonical canvas seeds now live in @tyroneross/agent-pack (alongside the
// governance PATTERNS they are bound to). Studio derives its patterns from there
// — one source of truth — and keeps its original public surface:
//   PATTERNS, SOLO_TOOL_AGENT_PATTERN_ID, findPatternById, canvasFromPattern.

export {
  CANVAS_PATTERNS as PATTERNS,
  SOLO_TOOL_AGENT_PATTERN_ID,
  findCanvasPattern as findPatternById,
  canvasFromPattern,
} from "@tyroneross/agent-pack";
