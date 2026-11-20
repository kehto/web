---
"@kehto/paja": minor
---

Static Paja can now use an optional resource proxy that you run yourself. Without one it reads resources directly and drops private destinations it can see in the URL. A proxy adds DNS-time private-IP checks, hop-by-hop redirect approval, and reads from hosts that don't send CORS headers. `kehto paja resource-proxy --allow-origin <origin> --port <port>` (or `startPajaResourceProxy`) starts a standalone NAP-RESOURCE proxy that reuses Paja's DNS-pinned transport, so the mandatory DNS-time private-IP checks from napplet/naps#80 @ ae5b9c6 still apply.

- **What the proxy enforces:** the existing size and time caps, and handing each redirect hop back to the browser.
- **Who can use it:** only allowlisted origins over CORS, including the preflight. It refuses to start without an allowlist.
- **Pointing static Paja at it:** set `PAJA_RESOURCE_PROXY_URL` when building the Pages artifact (or pass `resourceProxyUrl` to `createPajaRuntimeHostConfig`), or enter the URL in the new **Resource proxy (optional)** sidebar field. Napplets can't set it.
- **Browser behaviour:** it sends no cookies to a remote proxy, and it treats a 404 as `not-found` only when the proxy marks it as the upstream reply.
- **New setting:** `server.resourceProxyPreflightMaxAgeSeconds` controls the preflight cache.

An origin allowlist isn't authentication. Treat the proxy as an open fetch proxy limited to public addresses, and rate-limit it if you expose it.
