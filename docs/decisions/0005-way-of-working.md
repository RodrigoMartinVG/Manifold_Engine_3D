# 0005. How we work: branches, PRs, commits, tags, language

- **Status:** accepted; branches and PRs, replaced by [0009](0009-straight-to-main.md) (we work straight on `main`); the language (and with it, the commit messages and the tag names), replaced by [0011](0011-languages.md)
- **Date:** 2026-11-11

## Context

A professional project, even if a single person makes it (with help), and with a tutorial that has to be able to show the code **as it was** at each step.

## Decision

- **`main` always works.** It is protected on GitHub: it only takes changes through a _pull request_ (PR) with continuous integration green.
- **One step, one branch and one PR.** Branches are called `paso/NN-tema` (for example, `paso/01-mundo-y-fisica`). A step's PR brings **the code, its tests, its report in the Bitácora and, if it brings new ideas, its tutorial lessons** (modified by [0007](0007-executable-tutorial.md)); if one is missing, the step is not done.
- **Conventional commits, in Spanish:** `type(scope): what changed`. Types: `feat` (something new), `fix` (a fix), `docs`, `test`, `refactor`, `build` (tools, dependencies), `ci`, `chore`. Example: `feat(nucleo): gravedad como campo radial`.
- **One tag per step** (`paso-00`, `paso-01`...) when its PR is merged: the report and the lessons link to the code of their tag.
- **Continuous integration** (GitHub Actions) on every PR and on `main`: types, linter, formatting, headless tests, the site's build and the browser tests. If `main` passes, the site is published.
- **Break on purpose** every new test once, to see that it fails when it has to fail. In V1 there were tests that passed without testing anything.
- **Language: Spanish**, in the code (variable, function and file names), in the comments, in the commits and in the tutorial. It is consistent with the tutorial and with the author's way of learning. The price: it reaches fewer people on GitHub.

## Consequences

- Every step leaves a clear trail: branch, PR with its discussion, tag, report and lessons.
- Working only with PRs looks like bureaucracy; in exchange, continuous integration checks everything before it goes into `main`, and the history explains every change.

## Alternatives discarded

- **Direct commits to `main`:** faster, but nothing stops it from breaking. (Taken up again, with local checks, by 0009.)
- **Code in English:** more reach; consistency with the tutorial was chosen. (Taken up again by 0011: the mixed naming turned out to be the bigger cost.)
