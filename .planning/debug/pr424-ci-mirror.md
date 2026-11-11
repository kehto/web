---
status: verifying
trigger: PR 424 Playwright dependency-install failure
---

## Evidence

Head 56d04051 run 43047484167 failed before tests: apt exit 100 and repeated
Temporary failure resolving azure.archive.ubuntu.com while downloading fonts.
Build/types/docs/unit passed. Retry again stalled during browser installation.
Selecting the primary archive at 07d40939 also stalled before test execution.

## Resolution

Use the official mcr.microsoft.com/playwright:v1.59.1-noble job container, matching
the installed package. It includes browsers and system libraries, eliminating the
runtime apt and browser-download/cache paths. An explicit version guard fails if
a dependency bump is not accompanied by an image update. The test command,
assertions, retries and artifact capture are unchanged. No shipped package changes.

Official references: https://playwright.dev/docs/docker and
https://playwright.dev/docs/ci#via-containers document this CI approach.

## Verification

Image manifest exists for amd64/arm64. Workflow YAML and embedded bash parse.
Hosted exact-head CI is the final acceptance gate.
