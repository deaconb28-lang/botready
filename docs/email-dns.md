# Mail, DNS and the sender avatar

Everything botready.dev sends goes out through Resend from `team@botready.dev`
(`apps/web/lib/email.ts` is the only sender). This records what is in DNS, what
is wrong with it today, and what the blank circle next to our name in Gmail
would actually take to fill.

Checked 2026-09-05 against Cloudflare's resolver.

## What resolves today

| Name | Type | Value | State |
|---|---|---|---|
| `resend._domainkey.botready.dev` | TXT | `p=MIGfMA0GCSqGSIb3…` | correct |
| `send.botready.dev` | CNAME | `send.forge.rmta.net.` | correct, Resend's bounce host |
| `send.botready.dev` | TXT | `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` | correct |
| `botready.dev` | TXT | `v=spf1 include:_spf.purelymail.com ~all` | see below |
| `botready.dev` | TXT | `stripe-verification=29010af2…` | Stripe, in progress |
| `_dmarc.botready.dev` | TXT | `v=DMARC1; p=none;` | valid, but see below |
| `_dmarc.botready.dev` | TXT | `3ll2m5rq32sebuxzqtqokh4iprrpbvas.dkim.custom-email-domain.stripe.com.` | **wrong name** |
| `default._bimi.botready.dev` | CNAME | `pixie.porkbun.com.` | wildcard, not a real record |

Authentication is not the reason our mail lands in spam. Resend signs with DKIM
at a selector that aligns with the From domain, its bounce path under
`send.botready.dev` passes SPF, and DMARC is published. What we lack is sending
history, and only volume fixes that.

Worth understanding, because it is not obvious: **the apex SPF record does not
authorise Resend**, and does not need to. SPF is evaluated against the envelope
sender, which Resend sets under `send.botready.dev`, and that name carries its
own SPF. DMARC then passes on the DKIM signature, which is aligned. The apex
record exists for Purelymail.

That does matter for the third sender arriving. **Stripe is being set up to send
as botready.dev** — hence the verification token at the apex and the mail on
5 September saying the domain is "almost ready to go". Whatever include or CNAME
Stripe's dashboard asks for has to go in as well; the apex SPF as written
authorises Purelymail and nothing else.

## Two things to fix in DNS

**A Stripe DKIM value is sitting at `_dmarc`.** Stripe's custom email domain
setup hands you a hostname to publish, and it has been pasted as a second TXT
record at `_dmarc.botready.dev` instead of as a CNAME at the DKIM selector
Stripe named. Receivers should ignore it, because only one of the two TXT
records there begins with `v=DMARC1` and the spec says to discard the rest, but
it is doing nothing where it is and Stripe's own domain verification will keep
reporting itself unfinished until it moves. Delete it from `_dmarc` and publish
it where Stripe's dashboard asks for it.

**Porkbun answers every subdomain.** `random-nonexistent-xyz.botready.dev`
resolves to `pixie.porkbun.com`, so there is a wildcard CNAME in the zone. It is
why the BIMI lookup above returns a parking host rather than NXDOMAIN. Nothing
breaks, but any typo'd subdomain of ours serves somebody else's page, and it
will confuse every DNS check we or a customer runs against the domain. Remove
the wildcard.

## The avatar

Gmail draws a grey silhouette beside our name because nothing tells it what
else to draw. BIMI is the mechanism that would, and it has three parts. Two are
free and ready; the third is the one that decides whether Gmail plays along.

**The logo is built and served.** `apps/web/public/bimi.svg` is `app/icon.svg`
redrawn to the SVG Tiny Portable/Secure profile BIMI requires: version 1.2,
`baseProfile="tiny-ps"`, a `<title>`, a square viewBox, absolute pixel width and
height (Gmail asks for at least 96; ours is 512), and no script, animation or
external reference. Full-bleed violet with no rounded corners and no border,
because every client that shows it crops to a circle.

**The two records.** Neither exists yet.

```
_dmarc.botready.dev          TXT   v=DMARC1; p=quarantine; pct=100; rua=mailto:team@botready.dev
default._bimi.botready.dev   TXT   v=BIMI1; l=https://botready.dev/bimi.svg; a=
```

DMARC must move off `p=none` first: BIMI is ignored at none, and quarantine with
`pct=100` is what the spec asks for. Publish it only once Stripe's sending from
this domain is finished and passing, or Stripe's mail starts going to junk.

While publishing, delete the stray Stripe DKIM TXT record sitting at `_dmarc`
and remove the Porkbun wildcard, or the BIMI lookup keeps resolving to a parking
host instead of returning NXDOMAIN.

**The certificate is the open question.** Google's own documentation now says a
VMC is "recommended but not strictly required" and names a CMC as an
alternative, which is softer than the position everyone repeats. What is not in
doubt is that a VMC earns a checkmark beside the sender and that neither
certificate is available to us cheaply: a VMC needs a registered trademark and
runs about a thousand dollars a year, and a CMC needs the mark in continuous use
for twelve months, which rules us out until 2027.

So publish the two records with an empty `a=` and see. They cost nothing, Apple
Mail and Fastmail render a certificate-free BIMI logo today, and if Gmail turns
out to render it too we have the avatar for free. If it does not after a few
days, the cheap fallback is a Google Workspace mailbox on `team@botready.dev`
with a profile photo — about seven dollars a month, Resend keeps sending the
mail, and Google simply has a face to look up.
