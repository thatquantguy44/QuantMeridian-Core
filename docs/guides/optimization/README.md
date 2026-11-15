# Optimization suite guides

Each optimization module has two documents, readable here and in the terminal (the **Guide** button
on the module's header, or `/guides`):

| Module | White paper / business guide | Help & FAQ | What it is today |
|---|---|---|---|
| MMKT · Money Market Optimizer | [mmkt-whitepaper.md](mmkt-whitepaper.md) | [mmkt-help.md](mmkt-help.md) | Verified ticketed MIP execution plan (default) and continuous LP preview, on SIM rate sets |
| MMFO · Money Market Fund Optimizer | [mmfo-whitepaper.md](mmfo-whitepaper.md) | [mmfo-help.md](mmfo-help.md) | Local POC LP, not independently verified |

## Writing rules

- Every white paper has: Executive summary, Business problem, How it works, Data and provenance,
  Assumptions, Outputs and how to read them, Validation, Limitations, Status and governance, References.
- Every help guide has: Quick start, Screen guide, Assumptions and defaults, FAQ (one `###` per
  question), Troubleshooting, Glossary.
- `src/lib/moduleGuides.test.ts` enforces those sections, checks every internal link and anchor, and
  rejects broken tables and stray markup. Use only the markdown the in-app renderer supports
  (`src/lib/markdown.ts`): headings, paragraphs, lists (one nested level), pipe tables, fenced code,
  blockquotes, rules, and inline code, bold, italic and links. Escape a literal pipe in a table cell as `\|`.
- Link to terminal routes (`/money-market`) and other guides (`/guides/MMKT/help`); write repository
  paths as code, not links.
- When code changes a control, default or formula, update the module's help in the same change.
