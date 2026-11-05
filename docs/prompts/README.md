# Prompts and planning artifacts

ETHGlobal Mumbai asks teams that use AI tools to document where and how, and spec-driven teams to keep "all spec
files, prompts, and planning artifacts" in the repo. This folder holds the prompts. The spec is
`docs/spec/DESIGN.md`. File-level attribution is in `AI.md`.

| File | Tool | What it produced |
| --- | --- | --- |
| `01-cursor-v1.md` | Cursor cloud agent | v1: contracts, tests, scripts, web shell, keeper, docs (commits `4f83189`..`d7c4bfd`). **Export the Cursor agent prompts into this file before submitting.** |
| `02-claude-review.md` | Claude Code | Review of v1 against the Mumbai prize rules, with PoC tests. No code changes. |
| `03-claude-v2.md` | Claude Code | v2 fixes and features on `claude/admiring-galileo-aq0yo0`. |
