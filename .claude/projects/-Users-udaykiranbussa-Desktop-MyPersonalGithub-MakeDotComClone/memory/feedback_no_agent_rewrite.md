---
name: No agent for large file rewrites
description: User rejects agent tool for rewriting large files — do it directly with Write/Edit tools
type: feedback
---

Do NOT use the Agent tool to rewrite large files like nodeDefinitions.ts. Use Write or Edit tools directly in the main conversation.

**Why:** User rejected/interrupted the agent when it was about to rewrite nodeDefinitions.ts. They prefer to see the work happen in the main context.

**How to apply:** For large file rewrites, write the content directly using the Write tool in one shot, or use targeted Edit tool calls section by section.
