# 0009. Straight to main, without pull requests

- **Status:** accepted (it replaces the branches and PRs of [0005](0005-way-of-working.md))
- **Date:** 2026-11-11

## Context

[0005](0005-way-of-working.md) asked for everything to enter `main` through a _pull request_ (PR), with continuous integration green. In practice, in the first stages:

- **Nobody reviews the PRs.** The project is made by one person with an assistant: the author reviews by looking at the site, not at the PR.
- **Merging was a chore** that fell on the author: approve, wait, merge. With stacked PRs (one on top of the other) it was worse: when the first one was merged and its branch deleted, GitHub closed the one on top, and each one had to be rebased and wait for another check.
- **GitHub's checks can get stuck.** On 2026-11-11, the runs stayed queued for almost an hour without starting. Since `main` required them to pass, nothing could get in.

## Decision

- **We work straight on `main`.** Every change is one or more conventional commits (they follow 0005's rules, in English since [0011](0011-languages.md)), pushed to `main`.
- **Before pushing, it is checked on the machine:** `npm run verify` (types, linter, formatting and headless tests) and the tests in Chromium on the built site. It is the same that GitHub runs.
- **GitHub keeps checking every change to `main`, and the site is only published if it passes.** If something breaks, the published site stays the previous one until it is fixed.
- **`main` is still protected against the irreversible:** it cannot be deleted nor can its history be rewritten (no `push --force`).
- **The tags per stage stay** (`stage-00`, `stage-01`...; before 0011, `paso-00`): the tutorial and the Bitácora link to the code of their tag.
- **A PR is still possible** for something worth looking at apart before it goes in: a big experiment, or Dependabot's updates.

## Consequences

- The author does not have to approve or merge anything: they see the changes on the site or on their local server, and ask for adjustments.
- A mistake that passes the local check can reach `main`. GitHub's check stops it before publishing, and it is fixed with a new commit on top: history is not rewritten.
- `main`'s history shows every commit, instead of one commit per PR.

## Alternatives discarded

- **Keep PRs, but have them merge by themselves** when the check passes: it saves the clicks, but not the waits, nor the stacked PRs problem.
- **A working branch that is merged once in a while:** one more layer, with nobody to review it.
