# Behavioral guidelines

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.


# Behave like a human when interacting with cloud services

AI-written merge request (MR) descriptions or commit messages are banned. These are easy to recognize and waste reviewers' time. Do not be verbose, be precise and concise.
AI-generated responses to reviewer comments are banned. This undermines the human-to-human interaction fundamental to code review.
AI-written issue ("work item") descriptions or issue comments are banned. These are easy to recognize and waste reviewers time. Do not be verbose, be precise and concise.
No prefixes on branches such as claude/ codex/ gemini/, clear consise PR names, branch names, commit messages. No bodies on commit messages.

# DO NOT ADD COMMENTS INLINE IN THE CODE MAX 1 LINE OF COMMENT IF ABSOLUTELY NEEDED

## Code Style

- Use `pnpm`; do not introduce npm or yarn lockfiles.
- Use TypeScript/TSX
- ESLint enforces 4-space indentation, single quotes, semicolons, `eqeqeq`, no trailing spaces, and no `console` except `warn`/`error`.
- Use aliases.
- Prefer simple typescript with `types = {}`, export import, `const = () =>` for func declarations
- Before creating a new `useEffect` or any other effect think about react guidelines of using these and how can we avoid it to correctly follow guidelines. 
- Prefer stable function references, no inline in component `() => {}` passed as props
- Correctly scope components to either routes/route/components if component is only used on this route or to src/components if component is global or used on diff routes.


# Github Release flow
- When asked to release, you do not tag and release the merge commit of a any branch, to keep the history nice and clean you create a clean release commit which includes just the version bump without any PR to the main/master branch then tag this commit with respective tag