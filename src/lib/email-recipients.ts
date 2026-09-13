export type RecipientFieldInput = string | string[] | null | undefined;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return emailRegex.test(value);
}

function splitRecipientEntries(value: string): string[] {
  const entries: string[] = [];
  let current = "";
  let inQuotes = false;
  let angleBracketDepth = 0;

  for (const char of value) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (!inQuotes) {
      if (char === "<") {
        angleBracketDepth += 1;
      } else if (char === ">") {
        angleBracketDepth = Math.max(0, angleBracketDepth - 1);
      }

      if ((char === "," || char === ";") && angleBracketDepth === 0) {
        entries.push(current);
        current = "";
        continue;
      }
    }

    current += char;
  }

  entries.push(current);
  return entries;
}

function getRecipientEmailAddress(recipient: string): string {
  const displayNameMatch = recipient.match(/^.*<([^<>]+)>\s*$/);
  return displayNameMatch ? displayNameMatch[1].trim() : recipient;
}

export function isValidRecipientAddress(recipient: string): boolean {
  const emailAddress = getRecipientEmailAddress(recipient.trim());
  return isValidEmail(emailAddress);
}

export function normalizeRecipientField(
  value: RecipientFieldInput
): string[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalizedRecipients = rawValues
    .filter((entry): entry is string => typeof entry === "string")
    .flatMap((entry) => splitRecipientEntries(entry))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalizedRecipients.length > 0 ? normalizedRecipients : undefined;
}

export function persistRecipientField(value: string[] | undefined): string | undefined {
  return value && value.length > 0 ? value.join(", ") : undefined;
}
