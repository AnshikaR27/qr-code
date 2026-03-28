const CSS_VAR_NAMES = [
  '--primary',
  '--secondary',
  '--accent',
  '--bg',
  '--card-bg',
  '--text',
  '--text-muted',
  '--font-heading',
  '--font-body',
  '--radius',
  '--nav-bg',
  '--success',
  '--error',
  '--badge-bg',
  '--badge-text',
  '--veg',
  '--nonveg',
];

export async function fetchTokensFromStitch(projectId: string): Promise<Record<string, string>> {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) throw new Error('STITCH_API_KEY is not set');

  // Fetch the list of screens for the project
  const listRes = await fetch(
    `https://stitch.googleapis.com/v1/projects/${projectId}/screens?key=${apiKey}`
  );
  if (!listRes.ok) throw new Error(`Stitch list screens failed: ${listRes.status}`);

  const { screens } = await listRes.json() as {
    screens: Array<{ htmlCode?: { downloadUrl?: string }; name: string }>;
  };

  // Find the first screen that has generated HTML
  const screen = screens.find((s) => s.htmlCode?.downloadUrl);
  if (!screen?.htmlCode?.downloadUrl) {
    throw new Error('No generated screen found in this project');
  }

  const html = await fetch(screen.htmlCode.downloadUrl).then((r) => r.text());
  return parseCssVars(html);
}

function parseCssVars(html: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const name of CSS_VAR_NAMES) {
    // Match e.g.  --primary: #8B6914;  or  --font-heading: 'Noto Serif', serif;
    const escaped = name.replace(/[-]/g, '\\-');
    const match = html.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
    if (match) tokens[name] = match[1].trim();
  }
  return tokens;
}
