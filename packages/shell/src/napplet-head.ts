/** Insert trusted head content before any authored resource can be parsed. */
export function insertNappletHead(html: string, content: string): string {
  // Only consume a harmless prolog and bare container tags. Never search inside
  // authored comments, attributes, templates or scripts for a head/CSP marker.
  // For other HTML, an explicit head precedes it; the HTML parser merges later
  // html/body attributes and ignores duplicate head openings.
  const opening = /^([\t\n\f\r ]*(?:<!doctype[\t\n\f\r ]+html[\t\n\f\r ]*>[\t\n\f\r ]*)?(?:<html>[\t\n\f\r ]*)?)(<head>)?/i.exec(html)!;
  const prefix = opening[0];
  const insertion = opening[2] ? content : `<head>${content}</head>`;
  return `${prefix}${insertion}${html.slice(prefix.length)}`;
}
