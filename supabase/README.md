# Supabase edge functions

## Do you need one?

Ask before adding another. The web app already has `RESEND_API_KEY` and sends
through `apps/web/lib/email.ts`, so anything a Next route can do belongs in a
Next route: one fewer place holding the key, one fewer runtime, and it can be
tested with the rest of the suite.

An edge function earns its place when the caller is not the web app — a
database webhook, a Postgres trigger, an auth hook. Those cannot reach a Vercel
route with a session, and they can reach a function.

## `send-email`

Sends one of a fixed set of emails **to the signed-in person, about their own
account**. It is what puts a scan result in your inbox when you ran it on a
phone and will act on it from a laptop.

```
POST /functions/v1/send-email
Authorization: Bearer <the user's access token>

{ "template": "scan_result",  "scanId": "…" }   # the result, in your inbox
{ "template": "fixpack_link", "scanId": "…" }   # send my fix pack again
```

### Where the fix pack actually comes from

Not here. The buyer gets the files **attached to the purchase email**, sent by
the Stripe webhook in the web app — `sendFixpackReady` in
`apps/web/lib/email.ts`, assembled by `assembleFixPack` in `lib/fixpack.ts`.

That is deliberate, and it is not only about where the generator lives. The pack
is built by `packages/core`, which is npm TypeScript this Deno runtime cannot
import — but the deeper reason is that a link needs a session, sign-in is Google
only, and a buyer whose Stripe address is not a Google account could pay and
never reach what they bought. Attaching the files takes the account out of the
path: the thing they paid for is in the message.

`fixpack_link` is the second way in — "send it to me again" — and it emails the
download URL to someone who has already bought it. It checks the entitlement
with the service role rather than through RLS, because the answer decides
whether an email goes out at all, and a policy that quietly returns no rows
looks identical to "you have not bought this".

### The two rules

**The recipient is the session's own address, never a `to` in the body. The
body is a template key, never HTML.**

The obvious version of this function — read `{ to, subject, html }` and forward
it to Resend — is an open relay with an auth check in front of it. `auth:
"user"` does not help, because an account here is a free magic link: anyone who
can sign up could send arbitrary markup to arbitrary strangers from a domain we
have verified. The first person to notice would use it for phishing, and the
collateral is the transactional mail that actually matters — a fix pack that
does not arrive because the domain is on a blocklist.

Adding a template means adding a function to this file. That is the point.

### Deploying

```sh
supabase functions deploy send-email
supabase secrets set RESEND_API_KEY=re_…
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform. Do not set them as secrets.

The rate limit needs `db/migrations/0004_email_sends.sql` applied
(`pnpm db:migrate`). Without the table every send fails the count query.

### What it returns

| | |
|---|---|
| `200` | `{ sent: true, to, id }` — the provider's id, and nothing else it said |
| `400` | Bad body, unknown template, or a scanId that is not a uuid |
| `401` | No session. It only sends to your own address, so it needs to know whose |
| `404` | No scan with that id. An email whose only link is a 404 is worse than none |
| `429` | Five in an hour |
| `502` | The provider refused or did not answer. Its message is logged, not returned — an error body can carry the recipient and the key prefix |
| `503` | `RESEND_API_KEY` is not set. Fails closed rather than sending `Bearer undefined` |

### On the key

`Deno.env.get()` takes the **name** of a variable. The first draft of this
function passed the key itself, which asks for a variable named `re_live_…`,
gets `undefined`, and sends `Authorization: Bearer undefined` on every request —
hidden from the type checker by a `!`. If you find a key literal in this
directory, it is a leak and not a fallback: rotate it.
