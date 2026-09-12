# Repository Guidelines

## Git Workflow

1. Never create or use Git worktrees.
2. Do not create Git commits unless the user explicitly asks for a commit.
3. Let the user create a feature branch. If the current branch is `main`, do not modify files until the user explicitly allows changes on `main`.
4. After each completed implementation stage, provide one compact suggested Git commit message using the Conventional Commits format.
5. A suggested commit message is informational only. Do not run `git commit` unless the user explicitly requests it.

## Code Review Depth

When the user asks for a code review (e.g. "/code-review", "review this branch", "can you review my changes"), pick the depth from what they said, defaulting to **normal** if unspecified:

- **Shallow** ("quick", "shallow"): Skim the diff for obvious bugs, typos, and lint-level issues. No cross-file tracing.
- **Normal** (default): Review changed files for correctness bugs and obvious duplication, and correct code structure, domain, and code organization within those files.
- **Deep** ("deeper", "thorough", "deep dive"): Trace logic across the full diff and into files it touches (state flow between components/hooks, not just the lines that changed), actively hunt for subtle correctness bugs (stale state, race conditions, edge cases in external data), flag clean-code/deduplication opportunities, and verify assumptions about library behavior (e.g. by checking node_modules source) rather than guessing.

If the requested depth is ambiguous, ask which of the three they want rather than assuming.
