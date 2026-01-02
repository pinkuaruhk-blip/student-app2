"use client";

import { useState, useEffect, use } from "react";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { replacePlaceholders } from "@/lib/placeholders";
import { checkAndExecuteAutomations } from "@/lib/automation-engine-client";
import { useTranslations } from "next-intl";

interface FormField {
  id: string;
  name: string;
  label: string;
  type: "text" | "email" | "number" | "textarea" | "select" | "checkbox" | "radio" | "file" | "content";
  required: boolean;
  options?: string[];
  content?: string;
  acceptedFileTypes?: string;
  conditions?: {
    logic: "AND" | "OR";
    rules: Array<{
      id: string;
      fieldName: string;
      operator: "equals" | "notEquals" | "contains" | "isFilled" | "isEmpty";
      value?: string;
    }>;
  };
  prefillFromField?: {
    formId: string;
    formName: string;
    fieldName: string;
    fieldLabel: string;
  };
}

// Helper function to evaluate if a field should be visible based on conditions
function evaluateFieldVisibility(
  field: FormField,
  responses: Record<string, any>
): boolean {
  // If no conditions, field is always visible
  if (!field.conditions || field.conditions.rules.length === 0) {
    return true;
  }

  const { logic, rules } = field.conditions;

  // Evaluate each rule
  const ruleResults = rules.map((rule) => {
    const fieldValue = responses[rule.fieldName];
    const ruleValue = rule.value;

    switch (rule.operator) {
      case "equals":
        return String(fieldValue || "") === String(ruleValue || "");
      case "notEquals":
        return String(fieldValue || "") !== String(ruleValue || "");
      case "contains":
        return String(fieldValue || "").toLowerCase().includes(String(ruleValue || "").toLowerCase());
      case "isFilled":
        return fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== "";
      case "isEmpty":
        return fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === "";
      default:
        return false;
    }
  });

  // Combine results based on logic
  if (logic === "AND") {
    return ruleResults.every((result) => result);
  } else {
    // OR logic
    return ruleResults.some((result) => result);
  }
}

interface PageProps {
  params: {
    cardId: string;
    formId: string;
  };
}

export default function PublicFormPage({ params }: PageProps) {
  // Unwrap params Promise using React.use() for Next.js 15
  const { cardId, formId } = use(params);

  const tForms = useTranslations('forms');

  const [formData, setFormData] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  // Query the form, card, and check for existing submissions
  const { data, isLoading } = db.useQuery({
    stage_forms: {
      $: { where: { id: formId } },
    },
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: {
        pipe: {},
      },
      form_submissions: {
        form: {},
      },
    },
    system_settings: {}, // Fetch global variables
  });

  useEffect(() => {
    if (!isLoading && data) {
      const form = data.stage_forms?.[0];
      const card = data.cards?.[0];

      if (!form || !card) {
        setError("Form or card not found");
      } else {
        // Check if this specific form was already submitted for this card
        const existingSubmission = card.form_submissions?.find(
          (sub: any) => sub.form?.id === formId
        );

        if (existingSubmission) {
          setSubmitted(true);
        }

        setFormData({ form, card });

        // Pre-fill form fields based on prefillFromField configuration
        if (form.fields && card.form_submissions) {
          const prefillValues: Record<string, any> = {};

          for (const field of form.fields) {
            if (field.prefillFromField) {
              const { formId, fieldName } = field.prefillFromField;

              // Find the most recent submission of the source form
              const sourceSubmission = card.form_submissions.find(
                (sub: any) => sub.form?.id === formId
              );

              if (sourceSubmission && sourceSubmission.responses && sourceSubmission.responses[fieldName]) {
                prefillValues[field.name] = sourceSubmission.responses[fieldName];
              }
            }
          }

          // Set pre-filled values to responses state
          if (Object.keys(prefillValues).length > 0) {
            setResponses(prefillValues);
          }
        }
      }
      setLoading(false);
    }
  }, [data, isLoading, formId]);

  const handleInputChange = (fieldName: string, value: any) => {
    setResponses({
      ...responses,
      [fieldName]: value,
    });
  };

  const handleFileChange = async (fieldName: string, file: File | null, acceptedTypes?: string) => {
    // Clear previous error for this field
    setFileErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });

    if (!file) {
      setResponses({
        ...responses,
        [fieldName]: null,
      });
      return;
    }

    console.log("File selected:", file.name, "Size:", file.size, "bytes");

    // Check file size (limit to 2MB = 2,097,152 bytes)
    // Base64 encoding increases size by ~33%, so 2MB becomes ~2.66MB
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      setFileErrors((prev) => ({
        ...prev,
        [fieldName]: `File is too large (${sizeMB}MB). Maximum size is 2MB.`,
      }));
      setResponses({
        ...responses,
        [fieldName]: null,
      });
      return;
    }

    // Validate file type if acceptedTypes is specified
    if (acceptedTypes) {
      const types = acceptedTypes.split(",").map((t) => t.trim().toLowerCase());
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();

      let isValid = false;

      for (const type of types) {
        if (type.startsWith(".")) {
          // Extension check (e.g., .pdf, .jpg)
          if (fileName.endsWith(type)) {
            isValid = true;
            break;
          }
        } else if (type.includes("*")) {
          // Wildcard MIME type (e.g., image/*, application/*)
          const [category] = type.split("/");
          if (fileType.startsWith(category + "/")) {
            isValid = true;
            break;
          }
        } else {
          // Exact MIME type (e.g., application/pdf)
          if (fileType === type) {
            isValid = true;
            break;
          }
        }
      }

      if (!isValid) {
        setFileErrors((prev) => ({
          ...prev,
          [fieldName]: `Invalid file type. Accepted types: ${acceptedTypes}`,
        }));
        // Clear the file input
        setResponses({
          ...responses,
          [fieldName]: null,
        });
        return;
      }
    }

    // Convert file to base64 and upload to server
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      console.log("File converted to base64, uploading to server...");

      try {
        // Upload file to server
        const response = await fetch("/api/upload-file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileData: base64String,
            fileType: file.type,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to upload file");
        }

        const data = await response.json();
        console.log("✅ File uploaded successfully:", data.url);

        // Store file metadata with public URL
        setResponses({
          ...responses,
          [fieldName]: {
            name: file.name,
            type: file.type,
            size: file.size,
            url: data.url, // Public URL for sharing
            uniqueFileName: data.uniqueFileName,
          },
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        setFileErrors((prev) => ({
          ...prev,
          [fieldName]: "Failed to upload file. Please try again.",
        }));
        setResponses({
          ...responses,
          [fieldName]: null,
        });
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      setFileErrors((prev) => ({
        ...prev,
        [fieldName]: "Failed to read file. Please try again.",
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("=== Form Submission Starting ===");
    console.log("Card ID:", cardId);
    console.log("Form ID:", formId);
    console.log("Responses:", responses);

    // Calculate total data size
    const responsesJSON = JSON.stringify(responses);
    const dataSize = new Blob([responsesJSON]).size;
    console.log("Total data size:", dataSize, "bytes", `(${(dataSize / 1024).toFixed(2)} KB)`);

    // Warn if data is very large
    if (dataSize > 500000) { // 500KB
      console.warn("⚠️ Large submission detected. This may fail.");
    }

    // Check for file upload errors
    if (Object.keys(fileErrors).length > 0) {
      alert("Please fix file upload errors before submitting.");
      return;
    }

    // Double-check if form was already submitted (prevent race conditions)
    const card = data?.cards?.[0];
    const existingSubmission = card?.form_submissions?.find(
      (sub: any) => sub.form?.id === formId
    );

    if (existingSubmission) {
      alert("This form has already been submitted and cannot be resubmitted.");
      setSubmitted(true);
      return;
    }

    // Validate required fields (skip content fields as they're display-only, and skip hidden fields)
    const fields = formData.form.fields as FormField[];
    for (const field of fields) {
      // Skip content fields
      if (field.type === "content") continue;

      // Check if field is visible based on conditions
      const isVisible = evaluateFieldVisibility(field, responses);

      // Only validate if field is visible and required
      if (isVisible && field.required && !responses[field.name]) {
        alert(`Please fill in the required field: ${field.label}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const submissionId = id();
      console.log("Submission ID:", submissionId);
      console.log("Attempting database transaction...");
      console.log("Transaction data:", {
        responses,
        submittedAt: Date.now(),
        submitterEmail: submitterEmail || undefined,
        cardId: cardId,
        formId: formId,
      });

      const result = await db.transact([
        db.tx.form_submissions[submissionId]
          .update({
            responses,
            submittedAt: Date.now(),
            submitterEmail: submitterEmail || undefined,
          })
          .link({ card: cardId, form: formId }),
      ]);

      console.log("✅ Transaction result:", result);
      console.log("✅ Transaction completed successfully");

      // Wait a moment for the data to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger automations for form submission
      const card = data?.cards?.[0];
      if (card?.stage?.pipe?.id) {
        try {
          console.log("🤖 Triggering automation for form submission...", {
            cardId: cardId,
            pipeId: card.stage.pipe.id,
            formId: formId,
          });

          const automationResult = await checkAndExecuteAutomations({
            triggerType: "form_submission",
            cardId: cardId,
            pipeId: card.stage.pipe.id,
            context: {
              formId: formId,
            },
          });

          console.log("✅ Automation executed:", automationResult);
          console.log(`📊 Automation Report:
  • Found: ${automationResult.automationsFound}
  • Matched: ${automationResult.automationsMatched}
  • Executed: ${automationResult.automationsExecuted?.length || 0}`);
        } catch (error) {
          console.error("❌ Error triggering automations:", error);
          // Don't fail the form submission if automation fails
        }
      }

      setSubmitted(true);
      console.log("✅ Form marked as submitted");
    } catch (error: any) {
      console.error("❌ Error submitting form:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        error: error,
      });
      alert(`Failed to submit form: ${error.message || "Unknown error"}. Please try again.`);
      setSubmitting(false);
      return;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中... (Loading...)</p>
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">找不到表格 (Form Not Found)</h1>
          <p className="text-gray-600">
            {error || "The form you're looking for doesn't exist or has been removed."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tForms('formAlreadySubmitted')}</h1>
          <div className="text-gray-600 mb-4">
            <p>{tForms('formAlreadySubmittedMessage')}</p>
          </div>
          <p className="text-sm text-gray-500">
            {tForms('card')}: <span className="font-medium">{formData?.card?.title}</span>
          </p>
          <p className="text-xs text-gray-400 mt-4">
            {tForms('contactAdministrator')}
          </p>
        </div>
      </div>
    );
  }

  const fields = formData.form.fields as FormField[];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-8">
            <h1 className="text-3xl font-bold mb-2">{formData.form.name}</h1>
            <p className="text-blue-100">
              {tForms('for')}: <span className="font-medium">{formData.card.title}</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Dynamic Form Fields */}
            {fields.map((field) => {
              // Check if field should be visible based on conditions
              const isVisible = evaluateFieldVisibility(field, responses);

              // Don't render hidden fields
              if (!isVisible) return null;

              return (
              <div key={field.id}>
                {field.type !== "content" && (
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                {field.type === "content" && (
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {replacePlaceholders(field.label, {
                      card: {
                        title: formData.card.title,
                        description: formData.card.description,
                        fields: formData.card.fields || [],
                      },
                      stage: {
                        name: formData.card.stage?.name,
                      },
                      pipe: {
                        name: formData.card.stage?.pipe?.name,
                      },
                      form: {
                        name: formData.form.name,
                      },
                      formSubmissions: formData.card.form_submissions || [],
                      globalVariables: data?.system_settings?.[0]?.globalVariables || [],
                    })}
                  </h3>
                )}

                {/* Field Description - shown for all field types */}
                {field.description && (
                  <div className="text-sm text-gray-600 mb-3 flex items-start gap-2">
                    <span className="text-blue-500 flex-shrink-0">ℹ️</span>
                    <div dangerouslySetInnerHTML={{ __html: field.description }} />
                  </div>
                )}

                {field.type === "text" && (
                  <input
                    type="text"
                    value={responses[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {field.type === "email" && (
                  <input
                    type="email"
                    value={responses[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {field.type === "number" && (
                  <input
                    type="number"
                    value={responses[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {field.type === "date" && (
                  <input
                    type="date"
                    value={responses[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {field.type === "time" && (
                  <input
                    type="time"
                    value={responses[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {field.type === "textarea" && (
                  <textarea
                    value={responses[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {field.type === "select" && (
                  <select
                    value={responses[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選擇選項... (Select an option...)</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "checkbox" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={responses[field.name] || false}
                      onChange={(e) => handleInputChange(field.name, e.target.checked)}
                      required={field.required}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">是 (Yes)</span>
                  </div>
                )}

                {field.type === "radio" && (
                  <div className="space-y-2">
                    {field.options?.map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={field.name}
                          value={option}
                          checked={responses[field.name] === option}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          required={field.required}
                          className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {field.type === "file" && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept={field.acceptedFileTypes || undefined}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleFileChange(field.name, file, field.acceptedFileTypes);
                      }}
                      required={field.required}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <div className="flex items-start gap-2">
                      {field.acceptedFileTypes && (
                        <p className="text-xs text-gray-500">
                          Accepted: <code className="bg-gray-100 px-1 py-0.5 rounded">{field.acceptedFileTypes}</code>
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        • Max size: 2MB
                      </p>
                    </div>
                    {fileErrors[field.name] && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
                        <span>⚠️</span>
                        <span>{fileErrors[field.name]}</span>
                      </div>
                    )}
                    {responses[field.name] && !fileErrors[field.name] && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded border border-green-200">
                        <span>✓</span>
                        <span className="font-medium">{responses[field.name].name}</span>
                        <span className="text-gray-500">
                          ({(responses[field.name].size / 1024).toFixed(2)} KB)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {field.type === "content" && (
                  <div
                    className="prose prose-sm max-w-none bg-blue-50 border border-blue-200 rounded-lg p-4"
                    dangerouslySetInnerHTML={{
                      __html: replacePlaceholders(field.content || "", {
                        card: {
                          title: formData.card.title,
                          description: formData.card.description,
                          fields: formData.card.fields || [],
                        },
                        stage: {
                          name: formData.card.stage?.name,
                        },
                        pipe: {
                          name: formData.card.stage?.pipe?.name,
                        },
                        form: {
                          name: formData.form.name,
                        },
                        formSubmissions: formData.card.form_submissions || [],
                        globalVariables: data?.system_settings?.[0]?.globalVariables || [],
                      }),
                    }}
                  />
                )}
              </div>
            );
            })}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? `${tForms('submit')}...` : tForms('submit')}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by FlowLane</p>
        </div>
      </div>
    </div>
  );
}
