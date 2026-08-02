# BeamStudio Agent Routing

This repo prefers external `gstack` skills when they are installed on the machine.
Do not copy the skill bodies into this repository.

Expected external location on this machine:

- `~/.gemini/antigravity/skills/gstack`
- `~/.gemini/antigravity/skills/plan-eng-review`
- `~/.gemini/antigravity/skills/plan-ceo-review`
- `~/.gemini/antigravity/skills/review`

If those skills are available, use them first for matching requests. If they are not
available in the current environment, say so plainly and continue with the best local
fallback instead of blocking.

## Skill routing

Use these routes by default:

- Architecture review, codebase audit, engineering planning -> `plan-eng-review`
- CEO/founder framing, scope expansion, strategic rethink -> `plan-ceo-review`
- Code review, diff review, pre-landing review -> `review`
- Browser QA, site testing, dogfooding, screenshot-based verification -> `gstack`

## BeamStudio-specific policy

BeamStudio is a real-time Electron app with hardware-sensitive paths.

- Protect behavior first.
- Prefer incremental hardening over big-bang refactors.
- Do not touch DMX timing behavior unless there is a real bug and a verification path.
- If a UX control looks persistent, it should persist or clearly say it does not.
