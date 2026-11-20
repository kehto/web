---
"@kehto/paja": minor
---

Serve `@kehto/mocks` for every NAP Paja has no backend for (blossom, capture,
catalog, class, display, git, hashtree, location, mesh, motion, navigation,
nzb, pow, soulseek, system, torrent, value, worker). The mocked interfaces are
enabled by default and callable from napplets. They follow the usual
disable/grant policy, and the Interfaces panel marks each one with `◌` plus a
legend. New exports: `PAJA_MOCKED_DOMAINS`, `PAJA_MOCKED_MARK`,
`isPajaMockedDomain`, `PajaMockedDomain`.
