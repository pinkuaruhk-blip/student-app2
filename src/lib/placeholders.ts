/**
 * Placeholder replacement utility
 * Replaces placeholders like {{card_title}} with actual values
 */

interface PlaceholderData {
  card?: {
    title?: string;
    description?: string;
    fields?: Array<{ key: string; value: any }>;
  };
  stage?: {
    name?: string;
  };
  pipe?: {
    name?: string;
  };
  form?: {
    name?: string;
  };
  submission?: {
    responses?: Record<string, any>;
  };
  customFields?: Record<string, string>; // For field labels mapping
  formSubmissions?: Array<{
    form?: {
      id: string;
      name: string;
    };
    responses?: Record<string, any>;
  }>;
  globalVariables?: Array<{ name: string; value: string }>; // Global variables for templates
  clientForms?: Array<{ id: string; name: string; formType?: string }>; // Client forms for link generation
  cardId?: string; // Card ID for generating form links
}

/**
 * Replace placeholders in text with actual values
 */
export function replacePlaceholders(
  text: string,
  data: PlaceholderData,
  baseUrl?: string
): string {
  if (!text) return text;

  let result = text;

  // Helper function to convert relative URLs to absolute
  const makeAbsoluteUrl = (url: string): string => {
    if (!url) return url;
    // If already absolute, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If relative, prepend base URL
    const effectiveBaseUrl = baseUrl ||
                             process.env.NEXT_PUBLIC_APP_URL ||
                             (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    // Remove leading slash if present (to avoid double slashes)
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    return `${effectiveBaseUrl}/${cleanUrl}`;
  };

  // Card placeholders
  if (data.card?.title) {
    result = result.replace(/\{\{card_title\}\}/g, data.card.title);
    result = result.replace(/\{\{card\.title\}\}/g, data.card.title);
  }
  if (data.card?.description) {
    result = result.replace(/\{\{card_description\}\}/g, data.card.description);
    result = result.replace(/\{\{card\.description\}\}/g, data.card.description);
  }

  // Stage placeholder
  if (data.stage?.name) {
    result = result.replace(/\{\{stage_name\}\}/g, data.stage.name);
    result = result.replace(/\{\{stage\.name\}\}/g, data.stage.name);
  }

  // Pipe placeholder
  if (data.pipe?.name) {
    result = result.replace(/\{\{pipe_name\}\}/g, data.pipe.name);
    result = result.replace(/\{\{pipe\.name\}\}/g, data.pipe.name);
  }

  // Form placeholder
  if (data.form?.name) {
    result = result.replace(/\{\{form_name\}\}/g, data.form.name);
    result = result.replace(/\{\{form\.name\}\}/g, data.form.name);
  }

  // Current date
  result = result.replace(
    /\{\{current_date\}\}/g,
    new Date().toLocaleDateString()
  );

  // Current date and time
  result = result.replace(
    /\{\{current_datetime\}\}/g,
    new Date().toLocaleString()
  );

  // Card field placeholders (e.g., {{field_email}}, {{field_phone}})
  // Also supports direct field names (e.g., {{email}}, {{phone}}, {{商店名稱}})
  // Also supports {{card.field.XXX}} format
  if (data.card?.fields) {
    data.card.fields.forEach((field) => {
      // Support {{field_XXX}} format
      const fieldPlaceholder = `{{field_${field.key}}}`;
      const value = field.value || "";
      result = result.replace(new RegExp(fieldPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), String(value));

      // Also support direct field name format {{XXX}}
      const directPlaceholder = `{{${field.key}}}`;
      result = result.replace(
        new RegExp(directPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        String(value)
      );

      // Support {{card.field.XXX}} format
      const dottedPlaceholder = `{{card.field.${field.key}}}`;
      result = result.replace(
        new RegExp(dottedPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        String(value)
      );

      // Support using field label if customFields mapping provided
      if (data.customFields && data.customFields[field.key]) {
        const labelPlaceholder = `{{${data.customFields[field.key]}}}`;
        result = result.replace(
          new RegExp(labelPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          String(value)
        );
      }
    });
  }

  // Form submission placeholders (e.g., {{submission_company_name}})
  if (data.submission?.responses) {
    Object.entries(data.submission.responses).forEach(([key, value]) => {
      const placeholder = `{{submission_${key}}}`;
      result = result.replace(
        new RegExp(placeholder, "g"),
        String(value || "")
      );
    });
  }

  // Other form submission placeholders (e.g., {{form:FormName.field_name}})
  // Also handles form links (e.g., {{form:FormName.link}})
  if (data.formSubmissions && data.formSubmissions.length > 0) {
    console.log(`[Placeholders] Processing ${data.formSubmissions.length} form submissions`);
    data.formSubmissions.forEach((sub, idx) => {
      console.log(`  [${idx}] Form: "${sub.form?.name}", Fields:`, Object.keys(sub.responses || {}));
    });

    // Match pattern like {{form:FormName.field_name}} or {{form:FormName.link}}
    const formPlaceholderRegex = /\{\{form:([^.]+)\.([^}]+)\}\}/g;

    result = result.replace(formPlaceholderRegex, (match, formName, fieldName) => {
      console.log(`[Placeholders] Looking for form "${formName}", field/property "${fieldName}"`);

      // Special handling for .link - check clientForms instead of submissions
      if (fieldName.toLowerCase() === 'link') {
        if (!data.clientForms || !data.cardId) {
          console.log(`[Placeholders] ❌ Missing clientForms or cardId for generating link`);
          return "";
        }

        // Find the client form by name (case-insensitive)
        const clientForm = data.clientForms.find(
          (form) => form.name?.toLowerCase() === formName.toLowerCase()
        );

        if (!clientForm) {
          console.log(`[Placeholders] ❌ Client form not found: "${formName}"`);
          return "";
        }

        // Generate the form link URL
        const effectiveBaseUrl = baseUrl ||
                                 process.env.NEXT_PUBLIC_APP_URL ||
                                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        const formLink = `${effectiveBaseUrl}/form/${data.cardId}/${clientForm.id}`;
        console.log(`[Placeholders] ✅ Generated form link: "${formLink}"`);
        return formLink;
      }

      // Regular field lookup in form submissions
      const submission = data.formSubmissions!.find(
        (sub) => sub.form?.name?.toLowerCase() === formName.toLowerCase()
      );

      if (!submission) {
        console.log(`[Placeholders] ❌ Form not found: "${formName}"`);
        return ""; // Return empty string if form not found
      }

      console.log(`[Placeholders] ✅ Found form: "${submission.form?.name}"`);

      if (submission && submission.responses && submission.responses[fieldName]) {
        const value = submission.responses[fieldName];
        console.log(`[Placeholders] ✅ Field "${fieldName}" = "${value}"`);

        // Handle different value types
        if (typeof value === "boolean") {
          return value ? "Yes" : "No";
        } else if (typeof value === "object" && value?.url && value?.name) {
          // File upload with URL - show as link with image preview for images
          const isImage = value.type?.startsWith("image/");
          const absoluteUrl = makeAbsoluteUrl(value.url);

          if (isImage) {
            // For images, show thumbnail with link
            return `<a href="${absoluteUrl}" target="_blank" rel="noopener noreferrer">
              <img src="${absoluteUrl}" alt="${value.name}" style="max-width: 300px; max-height: 300px; border-radius: 4px; border: 1px solid #ddd;" />
            </a>`;
          } else {
            // For other files, show download link
            return `<a href="${absoluteUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">
              📎 ${value.name}
            </a>`;
          }
        } else if (typeof value === "object" && value?.data && value?.name) {
          // Legacy base64 file upload - show file name only
          return value.name;
        } else {
          return String(value);
        }
      }

      console.log(`[Placeholders] ❌ Field not found: "${fieldName}" in form "${submission.form?.name}"`);
      console.log(`[Placeholders] Available fields:`, Object.keys(submission.responses || {}));

      // Return empty string if not found
      return "";
    });
  }

  // Handle client form links even when no submissions exist (e.g., {{form:FormName.link}})
  if (data.clientForms && data.clientForms.length > 0 && data.cardId) {
    // Match pattern like {{form:FormName.link}}
    const formLinkRegex = /\{\{form:([^.]+)\.link\}\}/gi;

    result = result.replace(formLinkRegex, (match, formName) => {
      console.log(`[Placeholders] Looking for client form link "${formName}"`);

      // Find the client form by name (case-insensitive)
      const clientForm = data.clientForms!.find(
        (form) => form.name?.toLowerCase() === formName.toLowerCase()
      );

      if (!clientForm) {
        console.log(`[Placeholders] ❌ Client form not found: "${formName}"`);
        return "";
      }

      // Generate the form link URL
      const effectiveBaseUrl = baseUrl ||
                               process.env.NEXT_PUBLIC_APP_URL ||
                               (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const formLink = `${effectiveBaseUrl}/form/${data.cardId}/${clientForm.id}`;
      console.log(`[Placeholders] ✅ Generated client form link: "${formLink}"`);
      return formLink;
    });

    // Handle legacy {{form.link}} syntax for backward compatibility
    result = result.replace(/\{\{form\.link\}\}/gi, () => {
      console.log(`[Placeholders] Processing legacy {{form.link}} placeholder`);

      if (data.clientForms!.length === 1) {
        // Only 1 client form - use it automatically
        const clientForm = data.clientForms![0];
        const effectiveBaseUrl = baseUrl ||
                                 process.env.NEXT_PUBLIC_APP_URL ||
                                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        const formLink = `${effectiveBaseUrl}/form/${data.cardId}/${clientForm.id}`;
        console.log(`[Placeholders] ✅ Generated link for single form: "${formLink}"`);
        return formLink;
      } else {
        // Multiple forms - require specific form name
        console.log(`[Placeholders] ⚠️ Multiple client forms found (${data.clientForms!.length}). Use {{form:FormName.link}} syntax instead.`);
        return `[Error: Multiple forms available. Use {{form:FormName.link}} syntax]`;
      }
    });
  }

  // Global variables (e.g., {{year}}, {{company_name}})
  if (data.globalVariables && data.globalVariables.length > 0) {
    data.globalVariables.forEach((variable) => {
      const placeholder = `{{${variable.name}}}`;
      result = result.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        variable.value
      );
    });
  }

  return result;
}

/**
 * Get list of available placeholders for documentation
 */
export function getAvailablePlaceholders(): Array<{
  placeholder: string;
  description: string;
  category: string;
}> {
  return [
    {
      category: "Card Info",
      placeholder: "{{card_title}}",
      description: "The card's title",
    },
    {
      category: "Card Info",
      placeholder: "{{card_description}}",
      description: "The card's description",
    },
    {
      category: "Card Info",
      placeholder: "{{field_XXX}}",
      description: "Card field value (replace XXX with field key, e.g., {{field_email}})",
    },
    {
      category: "Pipeline Info",
      placeholder: "{{pipe_name}}",
      description: "The pipeline name",
    },
    {
      category: "Pipeline Info",
      placeholder: "{{stage_name}}",
      description: "The current stage name",
    },
    {
      category: "Form Info",
      placeholder: "{{form_name}}",
      description: "The form name",
    },
    {
      category: "Form Info",
      placeholder: "{{submission_XXX}}",
      description: "Form submission value (replace XXX with field name)",
    },
    {
      category: "Form Info",
      placeholder: "{{form:FormName.field_name}}",
      description: "Value from another form (replace FormName with exact form name and field_name with field key)",
    },
    {
      category: "Form Info",
      placeholder: "{{form:FormName.link}}",
      description: "Link to a client form (replace FormName with exact client form name)",
    },
    {
      category: "Form Info",
      placeholder: "{{form.link}}",
      description: "Link to client form (only works if there's exactly 1 client form)",
    },
    {
      category: "Date/Time",
      placeholder: "{{current_date}}",
      description: "Today's date",
    },
    {
      category: "Date/Time",
      placeholder: "{{current_datetime}}",
      description: "Current date and time",
    },
  ];
}
