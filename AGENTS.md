# Guidelines for Agents

Before coding:
- Read `README.md` for an overview of the app and its features. Remember to update it if a new feature is added or something in it has changed.

When finishing:
- Summarize what changed, why, and how to validate it.

## About this project

This repository is a client-side web app called **What's the Diff**.

It is a vanilla HTML/CSS/JavaScript text comparison tool with Playwright E2E tests.

Right now, the web-app can run locally via `index.html` without requiring a web server.

## Package manager

Currently, a package manager (`pnpm`) is only used for tests.

## Naming conventions

- localStorage keys: `wtd_*` prefix (`wtd_input_left`, `wtd_copy_richtext`, etc.).
