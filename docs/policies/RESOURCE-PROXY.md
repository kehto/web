# Paja resource proxy

Paja's resource resolver uses `POST /__kehto/resource` for one authorized HTTP(S)
hop. The browser resolver obtains resource and network approval before calling it,
then repeats authorization for every redirect. This transport does not itself
decide app permission. The runtime/service and host frame isolation remain
required parts of the resource boundary.

HTML routes redirect alias hosts to the configured canonical origin before
issuing a capability cookie. The proxy itself never redirects untrusted callers.

The endpoint accepts only its exact host and main-frame origin, JSON POSTs, and
the server-instance capability in a host-only, HttpOnly, SameSite=Strict cookie.
Cookie names include the bound port so local Paja instances do not overwrite each
other. The cookie works on HTTP development origins without falsely using the
Secure-only `__Host-` prefix. No capability appears in app configuration, iframe
messages, URLs, or logs. Null/foreign origins, missing credentials, simple content
types, and other methods are rejected before destination parsing or DNS. The
endpoint does not grant cross-origin access through CORS.

After DNS, the transport chooses a permitted address and pins it to that socket.
It preserves the original Host and TLS hostname, retains certificate validation,
and disables pooled connection reuse. Literal IP destinations receive the same
address policy without DNS. No upstream credentials or referrer are forwarded.

The private-address minimum comes from NAP-RESOURCE PR #80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`. Paja additionally rejects documentation,
benchmark, translation, protocol-assignment, and reserved ranges. Its IPv6 policy
admits only global unicast outside the excluded special-purpose ranges. This is
deliberately stricter host policy, including denial of public exceptions within
blocked ranges; it is not a claim that every blocked range is private. Address
vectors were checked on 2026-10-17 against the [IANA IPv4 registry](https://www.iana.org/assignments/iana-ipv4-special-registry/)
and [IANA IPv6 registry](https://www.iana.org/assignments/iana-ipv6-special-registry/).

The server does not follow redirects. Upstream 301/302/303/307/308 responses become
an HTTP 200 JSON envelope `{ "status": 302, "location": "/next" }` with
`x-kehto-resource-redirect: 1`. This lets the trusted browser resolver inspect the
next destination; an HTTP redirect with Fetch's manual mode would hide it behind
an opaque redirect response. Ordinary responses contain raw bytes, and their
upstream MIME is untrusted. The resource service must sniff/classify bytes and
apply SVG and scheme policy before delivery to the app.

Transport limits are 10 MiB per response and 30 seconds including DNS waiting.
Cancellation stops waiting for DNS and destroys an active request; late DNS cannot
open a socket. A disconnected host request aborts upstream work. Request JSON is
bounded to 4 KiB and ten seconds. The browser resolver owns the redirect-hop cap.

`packages/paja/src/server-resource-proxy.test.ts` covers rejected callers before
DNS, special-purpose and alternate IPv6 spellings, literal addresses, public
address pinning and TLS identity, readable one-hop redirects, body limits,
cancellation, DNS deadlines, and host disconnects. These focused tests do not
prove the separate app approval UI or iframe CSP wiring; the complete resource
migration requires the combined package and browser gates.
