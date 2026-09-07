/**
 * The three helpers every generator needs, in one place.
 *
 * They were copied between llms-txt.ts and jsonld.ts before the answer pack
 * needed them too, at which point three copies of "turn a title into a brand"
 * would have been three chances to disagree about what a brand is.
 */

/** `Example — a site an agent can read` on example.com becomes `Example`. */
export function brandFrom(title: string, domain: string): string {
  if (!title) return domain.split('.')[0] ?? domain;
  const head = title.split(/\s*[—|·–]\s*/)[0]?.trim();
  return head && head.length > 1 ? head : (domain.split('.')[0] ?? domain);
}

export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
}
