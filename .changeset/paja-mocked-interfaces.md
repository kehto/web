---
"@kehto/paja": minor
---

Serve `@kehto/mocks` for every on-track NAP Paja has no backend for (blossom,
capture, catalog, display, git, hashtree, location, motion, navigation, nzb,
pow, soulseek, system, torrent, value, worker). NAP-CLASS is DEFERRED upstream,
so its mock isn't exposed (`PAJA_UNMOCKED_DOMAINS`). A mock never replaces a
service the host already defines; it is skipped with one
`KEHTO_MOCK_DOMAIN_ALREADY_DEFINED` warning. The mocked interfaces are
enabled by default and callable from napplets. They follow the usual
disable/grant policy, and the Interfaces panel marks each one with `◌` plus a
legend. New exports: `PAJA_MOCKED_DOMAINS`, `PAJA_MOCKED_MARK`,
`PAJA_UNMOCKED_DOMAINS`, `isPajaMockedDomain`, `PajaMockedDomain`.
