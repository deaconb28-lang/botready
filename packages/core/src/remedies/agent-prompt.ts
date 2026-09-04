/**
 * botready-fixes.md: the full prompt for a coding agent.
 *
 * Paste it into Claude Code or Cursor and the site fixes itself. It is built
 * from the generated files and the punch list, so every path, token and value
 * in it came out of the scan. The prompt tells the agent what to place where,
 * what not to invent, and how to verify; it does not describe the site beyond
 * what was measured.
 */

import type { FixPack } from './index';

export function buildAgentPrompt(pack: FixPack, scanUrl?: string): string {
  const lines: string[] = [];
  lines.push(
    `# Make ${pack.domain} readable to AI agents`,
    '',
    'You are working in the repository that serves this site. Apply the changes below in order, one commit each, and stop after each one so I can review.',
    '',
    `Every file in this prompt was generated from a scan of ${pack.domain}${scanUrl ? ` (${scanUrl})` : ''}. Treat the values as facts about the site as it was measured. Where a file contains an <angle-bracket placeholder>, the scan could not read that fact; ask me for it rather than guessing.`,
    '',
    '## Rules',
    '',
    '- Do not invent page titles, prices, descriptions or URLs. Use only what is in the files below or already in the repository.',
    '- Do not change how the site serves human visitors. Every change here adds a file, a tag, or an edge rule.',
    '- Serve every added file with the content type its extension implies (`text/plain` for .txt, `application/ld+json` for JSON-LD).',
    '- After each change, confirm the file is reachable at its public path with a plain `curl`, as an anonymous client.',
    '',
    '## Punch list, in order of effort',
    '',
  );

  for (const [i, item] of pack.punchList.entries()) {
    lines.push(`${i + 1}. **${item.title}** (${item.effort}, ${item.owner}${item.file ? `, file: \`${item.file}\`` : ''}, recovers ${item.pointsRecovered} points)`);
    lines.push(`   ${item.rationale}`);
    lines.push('');
  }

  lines.push('## Files', '', 'Place each file at the path named in its heading. Contents follow verbatim.', '');

  for (const file of pack.files) {
    lines.push(`### \`${targetPath(file.name)}\``, '');
    lines.push(file.purpose);
    if (file.incomplete) lines.push('', '> This file is incomplete: the scan could not read everything it needs. Fill the placeholders from the repository or ask me.');
    lines.push('', '```' + fence(file.language), file.content.replace(/\n+$/, ''), '```', '');
  }

  lines.push(
    '## Verify',
    '',
    `1. Run \`curl -A "ClaudeBot/1.0" -sI https://${pack.domain}/\` and confirm a 200 with the same status class Chrome gets.`,
    `2. Run \`curl -s https://${pack.domain}/llms.txt | head\` and confirm the generated file is served as text.`,
    `3. Open https://botready.dev/r/${pack.domain} and re-run the check. Paste the new grade in your final message.`,
    '',
  );

  return lines.join('\n');
}

function targetPath(name: string): string {
  if (name === 'llms.txt' || name === 'robots.txt') return `/${name}`;
  if (name === 'waf-rule.txt') return 'edge: WAF custom rule (not a file in the repo)';
  if (name === 'jsonld.html') return 'the <head> of the pages named inside';
  if (name === 'markdown-alternates.html') return 'the <head> of the pages named inside';
  return name;
}

function fence(language: string): string {
  return { markdown: 'markdown', text: 'text', html: 'html', json: 'json' }[language] ?? '';
}
