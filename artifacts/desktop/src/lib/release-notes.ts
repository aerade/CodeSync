/**
 * Utilities for handling release notes from electron-updater.
 * GitHub releases can return either HTML or plain Markdown; we normalise to
 * readable plain text so we can show it safely in the UI without an HTML
 * sanitiser dependency.
 */

/** Basic HTML entity map */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:#39|amp|lt|gt|quot|apos|nbsp);/g, (match) => HTML_ENTITIES[match] ?? match);
}

/**
 * Convert raw release notes (HTML or Markdown) to clean plain text.
 * - Strips all HTML tags
 * - Decodes common HTML entities
 * - Collapses excessive whitespace / blank lines
 */
export function toPlainText(raw: unknown): string {
  if (raw == null) return "";

  // electron-updater can return a structured array of {version, note} objects
  // in some environments — coerce those safely to a string before processing.
  let text: string;
  if (typeof raw === "string") {
    text = raw;
  } else if (Array.isArray(raw)) {
    text = raw
      .map((item) =>
        typeof item === "string"
          ? item
          : typeof item?.note === "string"
          ? item.note
          : String(item ?? "")
      )
      .join("\n\n");
  } else {
    text = String(raw);
  }

  if (!text) return "";

  // Replace block-level HTML with newlines so we don't lose paragraph structure
  text = text.replace(/<\/?(p|br|li|h[1-6]|tr|div|blockquote)[^>]*>/gi, "\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode entities
  text = decodeHtmlEntities(text);

  // Collapse runs of blank lines to a single blank line
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing whitespace per line
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  return text;
}

/**
 * Return a short summary suitable for a toast description.
 * Takes the first `maxChars` characters of the plain-text notes, ending at a
 * word boundary, and appends "…" if truncated.
 */
export function toSummary(raw: unknown, maxChars = 160): string {
  const plain = toPlainText(raw);
  if (!plain) return "";

  // Use only the first paragraph for the summary
  const firstParagraph = plain.split("\n\n")[0].replace(/\n/g, " ").trim();

  if (firstParagraph.length <= maxChars) return firstParagraph;

  const truncated = firstParagraph.slice(0, maxChars).replace(/\s+\S*$/, "");
  return truncated + "…";
}
