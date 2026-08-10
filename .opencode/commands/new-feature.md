---
description: Create a new feature end-to-end. Generates TDD, PRD, roadmap, plan, code (src/<slug>/), review, and documentation. Usage: /new-feature <slug>: <feature-name>
---

You are creating a new feature. The argument is: "$ARGUMENTS"

Parse the argument:
- **Short slug** (used for folder names): the part before the first `: ` (colon-space)
- **Feature name** (used for display/titles): the part after the first `: `

For example, if the argument is `auth: User Authentication with JWT`:
- Short slug = `auth`
- Feature name = `User Authentication with JWT`

Execute the full pipeline below using the **short slug** for all file paths and the **feature name** for document titles, headings, and display.

## Step 1 — TDD (Technical Design Document)

Load the technical-design-doc-creator skill. Create a Technical Design Document for the feature. At the end, save the complete TDD to `specification/<slug>/tdd.md`.

## Step 2 — PRD (Product Requirements Document)

Load the tlc-spec-driven skill. Read `specification/<slug>/tdd.md` and use the Specify phase to create a Product Requirements Document from it. At the end, save the complete PRD to `specification/<slug>/prd.md`.

## Step 3 — Roadmap

Load the tlc-spec-driven skill. Read `specification/<slug>/tdd.md` and `specification/<slug>/prd.md`. Use the Design and Tasks phases to create a structured roadmap with prioritized features, task breakdown, and estimated dependencies. At the end, save the complete roadmap to `specification/<slug>/roadmap.md`.

## Step 4 — Plan

Load the tlc-spec-driven skill. Read `specification/<slug>/prd.md` and `specification/<slug>/roadmap.md`. Use the Design and Tasks phases to create a detailed implementation plan with task breakdown, dependencies, and execution order. At the end, save the complete plan to `specification/<slug>/plan.md`.

## Step 5 — Generate Code

Load the tlc-spec-driven skill. Read `specification/<slug>/plan.md` and execute the Tasks and Implement phases to generate the planned code. Generate all code inside the `src/<slug>/` directory following the plan's task breakdown, dependencies, and execution order. Write tests as specified in the plan.

## Step 6 — Code Review

Load the code-review-skill. Review all code in `src/<slug>/` and evaluate its coverage and alignment against the requirements in `specification/<slug>/prd.md` and the tasks in `specification/<slug>/plan.md`. At the end, save the complete review report to `specification/<slug>/review.md`.

## Step 7 — Documentation

Load the docs-writer skill. Review the code in `src/<slug>/` and the specs in `specification/<slug>/`, then create comprehensive documentation for the feature. At the end, save all documentation files inside the `documentation/<slug>/` directory.

---

After all 7 steps are complete, summarize what was created with the file paths.
