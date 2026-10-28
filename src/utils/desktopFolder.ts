/**
 * Desktop folder actions: creation and renaming.
 * Tolerates voice transcription nuances, spelling typos, and Hindi/Hinglish phrasing.
 * Names are validated again natively.
 */

const NEGATION = /\b(don't|do not|never|mat|nahi|nahin)\b|मत|नहीं/iu;
const DESKTOP_REGEX = /\b(?:deskt[oa]?p|dextop)\b|डेस्कटॉप/iu;
const FOLDER_REGEX = /\b(?:fold[ea]?rs?|fldr|directory|dir)\b|फोल्डर|फ़ोल्डर/iu;
const CREATE_VERBS = /\b(?:create|make|banao|bana\s*(?:do|de|dena|o)?|bna\s*(?:do|de|dena|o)?|tayyar\s*karo|new|add)\b|बनाओ|बना\s*(?:दो|दे|देना)|बनाना|तैयार\s*करो|नया/iu;
const RENAME_VERBS = /\b(?:rename|badlo|badal\s*(?:do|de|dena|o)?|change\s*name|naam\s*(?:badlo|badal|change))\b|रीनेम|बदलो|बदल\s*(?:दो|दे)|नाम\s*बदलो|नाम\s*बदल/iu;

export function desktopFolderRequest(text: string): { name: string } | null {
  if (NEGATION.test(text)) return null;
  // Prevent catching "open desktop folder" or pure navigation
  if (/^\s*(?:open|show|kholo|khol)\s+(?:the\s+)?desktop\s+folder\s*$/iu.test(text)) return null;
  // If user says rename, route to rename parser, not create
  if (RENAME_VERBS.test(text)) return null;

  if (!DESKTOP_REGEX.test(text) || !FOLDER_REGEX.test(text) || !CREATE_VERBS.test(text)) return null;

  const quoted = text.match(/["“]([^"”]+)["”]/u)?.[1];
  const named =
    text.match(/(?:named|called|naam ka|naam se|नाम का|नाम से)\s+([\p{L}\p{N} _-]+?)(?:\s+(?:on|on the|pe|par|per)\s+(?:deskt[oa]p|dextop)\b|[.!?।]|$)/iu)?.[1] ||
    text.match(/(?:deskt[oa]p|dextop|pe|par)\s+(?:pe|par)?\s*["“]?([\p{L}\p{N} _-]+?)["”]?\s+(?:naam ka|naam se)\s+fold[ea]r/iu)?.[1];

  return { name: (quoted || named || 'New Folder').trim() };
}

export function desktopFolderRenameRequest(text: string): { oldName: string; newName: string } | null {
  if (NEGATION.test(text)) return null;
  if (!RENAME_VERBS.test(text)) return null;
  // Requires mention of desktop or folder
  if (!DESKTOP_REGEX.test(text) && !FOLDER_REGEX.test(text)) return null;

  // Pattern 1: Quotes e.g. rename "Old" to "New" or rename folder "Old" to "New"
  const quotedPair = text.match(/(?:rename|badlo|change)\s+(?:(?:desktop|the)\s+)?(?:fold[ea]rs?\s+)?["“]([^"”]+)["”]\s+(?:to|into|as|mein|me|ko)\s+["“]([^"”]+)["”]/iu) ||
    text.match(/["“]([^"”]+)["”]\s+(?:ko|se)\s+["“]([^"”]+)["”]\s*(?:rename|kar do|badal do)/iu);
  if (quotedPair) {
    return { oldName: quotedPair[1].trim(), newName: quotedPair[2].trim() };
  }

  // Pattern 2: rename [folder] X to Y [on desktop]
  const patternTo = text.match(/(?:rename|change)\s+(?:desktop\s+)?(?:fold[ea]rs?\s+)?([\p{L}\p{N}_-]+)\s+(?:to|as|into)\s+([\p{L}\p{N}_-]+)(?:\s+(?:on|in)\s+desktop)?/iu);
  if (patternTo && patternTo[1].toLowerCase() !== 'desktop' && patternTo[1].toLowerCase() !== 'folder') {
    return { oldName: patternTo[1].trim(), newName: patternTo[2].trim() };
  }

  // Pattern 3: Hinglish: [desktop pe] [folder] X ko Y [me/naam se] rename/badal do
  const patternHinglish = text.match(/(?:desktop\s+(?:pe|par)\s+)?(?:fold[ea]rs?\s+)?([\p{L}\p{N}_-]+)\s+ko\s+([\p{L}\p{N}_-]+)\s+(?:rename|badal|naam)/iu) ||
    text.match(/(?:desktop\s+(?:pe|par)\s+)?(?:fold[ea]rs?\s+)?([\p{L}\p{N}_-]+)\s+ka\s+naam\s+(?:badal\s+ke\s+)?([\p{L}\p{N}_-]+)\s*(?:rakh|kar|do|kardo)/iu);
  if (patternHinglish && patternHinglish[1].toLowerCase() !== 'desktop' && patternHinglish[1].toLowerCase() !== 'folder') {
    return { oldName: patternHinglish[1].trim(), newName: patternHinglish[2].trim() };
  }

  return null;
}
