# The domain on the Google sign-in screen

Signing in shows "to continue to **aapiboxfkjeuqhfhpfyb.supabase.co**". That
string is the host of the OAuth redirect URI, which is Supabase's, because
Google sends the authorization code to `https://<project-ref>.supabase.co/auth/v1/callback`.

## It is not a security problem

Nothing is leaking. The project ref is public by design: it is in every auth URL
the browser already follows, and knowing it grants nothing on its own. Google is
doing the one thing that screen exists to do, which is name the party that will
receive the token, honestly and without our being able to overwrite it.

That last part is the point. A consent screen that let the requesting app print
whatever domain it liked would be worthless, because the first thing every
phishing page would print is the domain it is impersonating. So there is no way
to "cloak" this, and we should not want one.

What is real is the cost in trust. Somebody one click into signing up for
botready.dev is being asked to approve a hostname they have never seen, and some
of them will stop. The fix is not to change the label. It is to make the
destination actually be ours.

## Making it say botready.dev

Two pieces, and both are needed.

**1. A Supabase custom domain.** Supabase's docs name this exact case: the add-on
exists for "when you are using OAuth (social login) with Supabase Auth and the
project's URL is shown on the OAuth consent screen". With it, auth serves from
something like `auth.botready.dev` and OAuth flows advertise that as the callback
instead. It is a paid add-on on a paid plan; check Supabase's pricing page for
the current figure.

This one is not optional, and the reason is worth understanding. Google requires
every domain in an OAuth client's redirect URIs and branding to be listed as an
*authorized domain*, and it only accepts domains you have verified ownership of
in Search Console. We cannot verify `supabase.co`. So as long as the callback
lives there, the branding below cannot be completed.

**2. Google Cloud Console branding.** Under APIs & Services → OAuth consent
screen, set the app name to `botready.dev`, add the homepage, privacy policy and
terms URLs on our own domain, and add `botready.dev` to authorized domains.
Update the OAuth client's redirect URI to the new auth host, and change
Supabase's Google provider settings to match. Uploading a logo triggers Google's
brand verification review, which takes days to weeks; a name change alone
generally does not.

Order matters: custom domain first, then the redirect URI, then branding. Doing
branding first fails on the authorized-domain rule.
