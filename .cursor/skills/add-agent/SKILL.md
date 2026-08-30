---
name: add-agent
description: Adds or changes an inline @mention Gemini agent (AgentDefinition, registry, tools, host vs worker). Use when creating a new agent, adding tools, or changing bro/weather/calculator/time.
---

# Add an inline agent

1. Copy `src/agents/calculator.ts` (or `weather.ts` / `time.ts`) into `src/agents/<id>.ts`.
2. Set unique lowercase `id`, picker `name`/`description`, and a short `systemPrompt` that names the tools.
3. Declare `tools` with JSON-ish `parameters` (`required` on needed keys). Implement `executeTool`; throw on unknown names / missing args.
4. Register in `src/agents/registry.ts` array. Re-export from `src/agents/index.ts`.
5. Host/editor tools only: add `host: true` on the tool, implement in `src/utils/noteBlocks.ts`, and keep `executeTool` from handling that name (see `bro.ts` note tools). Worker cannot touch the ProseMirror doc.
6. Reuse existing helpers (`safeEvaluate`, `fetchWeather`, `formatTime`) instead of duplicating.

Do not change `gemini.ts` JSON contract or `harness.ts` loop unless the task is the runtime itself. Picker search uses `id`, `name`, and `description` in `searchAgents`.
