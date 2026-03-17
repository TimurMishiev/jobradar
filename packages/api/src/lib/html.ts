// Strips HTML tags and decodes common entities from a string.
// Used by both normalization (Greenhouse entity-encoded HTML) and
// Workday enrichment (raw HTML from the detail endpoint).
export function stripHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
