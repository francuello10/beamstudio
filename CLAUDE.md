# BeamStudio Agent Routing

This repo prefers external `gstack` skills when they are installed on the machine.
Do not vendor or copy skill contents into this repository.

Expected external location on this machine:

- `~/.gemini/antigravity/skills/gstack`
- `~/.gemini/antigravity/skills/plan-eng-review`
- `~/.gemini/antigravity/skills/plan-ceo-review`
- `~/.gemini/antigravity/skills/review`

If those skills are available, use them first for matching requests. If they are not
available in the current environment, say so plainly and continue with the best local
fallback instead of blocking.

## Skill routing

When the user's request matches an available skill, invoke that skill workflow first
instead of answering ad hoc.

Key routing rules for this repo:

- Architecture review, codebase audit, engineering plan, "how should we structure this" -> `plan-eng-review`
- Scope rethink, CEO/founder review, "think bigger", strategy framing -> `plan-ceo-review`
- Code review, pre-merge review, "check this diff" -> `review`
- Browser QA, dogfooding, deployment verification, screenshots -> `gstack`

## BeamStudio-specific policy

This is a hardware-adjacent real-time app. Prefer changes that preserve behavior.

- Do not rewrite working DMX timing paths without a concrete bug and a validation plan.
- Prefer hardening, observability, tests, and single-source-of-truth fixes over large refactors.
- If the product is working well, optimize for "improve without breaking".
