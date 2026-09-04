# Three X posts, ready to send

Standalone, not a thread. Post them on different days — each one assumes no
knowledge of the others, and together they cover the three things somebody has
to believe: that the problem is real, that it is worth understanding, and that
we are honest about our own numbers.

Every figure in post 3 came off a real scan of botready.dev through its own API.
Re-run it before posting and use what you actually get.

---

## Post 1 — the finding

**Image:** `assets/out/x-post-curl.png` (1600×900)

```
Your site probably returns 200 to Chrome and 403 to ClaudeBot.

Same URL. Same second. Same IP address.

Nobody decided that. It's a bot-fight preset, or a robots.txt somebody pasted in
2023 and left.

And you can't see it — a refused request never becomes a session, so it never
reaches your analytics. Search Console is green, because Googlebot got through
fine.

Two curl commands will tell you. Or 30 seconds, free, no account:
botready.dev
```

*Why this one leads: it is a claim the reader can falsify in their own terminal
in under a minute, which is the only reason to believe the rest of it.*

---

## Post 2 — the half nobody checks

**Image:** `assets/out/x-post-render.png` (1600×900)

```
The clients that answer questions about your company don't run your JavaScript.

So a price rendered by React isn't a wrong price. It's no price.

Check it without any tool: view-source on your pricing page — actual
view-source, not the inspector, which lies to you by showing the page after JS
has run — and search for your headline number.

Not there? Not there for them either.

The fix is usually one build setting, not a rewrite.
```

*Teaches something useful whether or not they ever run the scan, which is what
earns the third post the right to sell.*

---

## Post 3 — our own score

**Image:** `assets/out/x-post-ourscore.png` (1600×900)

```
We pointed our own scanner at our own site.

57 out of 100. Grade C. Seven checks failed.

No llms.txt. No agent manifest. No structured data. No markdown alternate. And
every date in our sitemap was the deploy timestamp — which is the exact thing we
fail other sites for.

Fixed them the same day and published what changed.

If you're going to sell a number, you have to be willing to post your own.

botready.dev
```

*The strongest of the three. It is the only one a competitor cannot copy,
because it costs something to say.*

---

## Notes

- **One a day, not three in a row.** Three posts about the same product in an
  hour reads as a campaign; three over a week reads as someone with a thing to
  say.
- **No hashtags.** They do nothing on X and they signal marketing.
- **Post 1 will attract "this is just SEO".** The reply is in `launch-kit.md`;
  have it ready rather than writing it live.
- **Nobody replies to a link.** If a post is quiet, reply to your own with the
  specific finding from someone's real site — with their permission.
