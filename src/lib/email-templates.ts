/**
 * Email Template Processing Utility
 * Processes email templates and replaces placeholders with actual card/form data
 */

interface EmailTemplateData {
  card?: {
    title?: string;
    description?: string;
    fields?: Array<{ key: string; value: any }>;
  };
  form?: {
    id?: string;
    name?: string;
    link?: string; // Full form URL
  };
  stage?: {
    name?: string;
  };
  pipe?: {
    name?: string;
  };
}

/**
 * Process email template by replacing placeholders with actual data
 */
export function processEmailTemplate(
  template: string,
  data: EmailTemplateData
): string {
  let result = template;

  // Replace card placeholders
  if (data.card) {
    result = result.replace(/\{\{card\.title\}\}/g, data.card.title || "");
    result = result.replace(/\{\{card\.description\}\}/g, data.card.description || "");

    // Replace card field placeholders {{card.field.FIELDNAME}}
    if (data.card.fields) {
      const fieldRegex = /\{\{card\.field\.([^}]+)\}\}/g;
      result = result.replace(fieldRegex, (match, fieldKey) => {
        const field = data.card!.fields!.find(
          (f: any) => f.key === fieldKey
        );
        if (field) {
          // Handle different value types
          if (typeof field.value === "boolean") {
            return field.value ? "Yes" : "No";
          } else if (typeof field.value === "number") {
            return String(field.value);
          } else if (typeof field.value === "object" && field.value?.url) {
            // File with URL - return link
            return field.value.url;
          } else {
            return String(field.value || "");
          }
        }
        return "";
      });
    }
  }

  // Replace form placeholders
  if (data.form) {
    result = result.replace(/\{\{form\.link\}\}/g, data.form.link || "");
    result = result.replace(/\{\{form\.name\}\}/g, data.form.name || "");
    result = result.replace(/\{\{form\.id\}\}/g, data.form.id || "");
  }

  // Replace stage placeholders
  if (data.stage) {
    result = result.replace(/\{\{stage\.name\}\}/g, data.stage.name || "");
  }

  // Replace pipe placeholders
  if (data.pipe) {
    result = result.replace(/\{\{pipe\.name\}\}/g, data.pipe.name || "");
  }

  return result;
}

/**
 * Get form link URL for a card and form
 */
export function getFormLink(cardId: string, formId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/form/${cardId}/${formId}`;
}
