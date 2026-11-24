/**
 * Safe HTML attribute escaping helper to prevent attribute breakout or XSS from
 * provider-controlled station names or user-supplied strings in HTML templates.
 */
export function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
