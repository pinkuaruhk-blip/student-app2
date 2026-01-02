"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { RichTextEditor } from "./rich-text-editor";
import { useToast } from "@/contexts/toast-context";

interface FieldCondition {
  id: string;
  fieldName: string; // which field to check
  operator: "equals" | "notEquals" | "contains" | "isFilled" | "isEmpty";
  value?: string; // value to compare (not needed for isFilled/isEmpty)
}

interface FormField {
  id: string;
  name: string;
  label: string;
  description?: string; // Optional help text shown below the field
  type: "text" | "email" | "number" | "textarea" | "select" | "checkbox" | "radio" | "file" | "content" | "date" | "time";
  required: boolean;
  options?: string[]; // For select and radio fields
  content?: string; // For content/display fields (HTML/rich text)
  acceptedFileTypes?: string; // For file fields - comma-separated MIME types or extensions (e.g., ".pdf,.jpg,.png" or "image/*,application/pdf")
  conditions?: {
    logic: "AND" | "OR"; // how to combine multiple conditions
    rules: FieldCondition[];
  };
  prefillFromField?: {
    formId: string; // Which form to get the value from
    formName: string; // For display purposes
    fieldName: string; // Which field in that form
    fieldLabel: string; // For display purposes
  };
}

interface StageFormBuilderProps {
  stageId: string;
  existingFormId?: string; // Optional: if provided, we're editing
  onClose: () => void;
}

export function StageFormBuilder({ stageId, existingFormId, onClose }: StageFormBuilderProps) {
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"client" | "admin">("client"); // Form type
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // Form for adding/editing a field
  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldDescription, setFieldDescription] = useState(""); // Help text for the field
  const [fieldType, setFieldType] = useState<FormField["type"]>("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");
  const [fieldContent, setFieldContent] = useState(""); // For content/display fields
  const [fieldAcceptedFileTypes, setFieldAcceptedFileTypes] = useState(""); // For file fields
  const [n8nFields, setN8nFields] = useState<Array<{ name: string; label: string }>>([]);

  // Prefill state
  const [showPrefill, setShowPrefill] = useState(false);
  const [prefillFormId, setPrefillFormId] = useState("");
  const [prefillFieldName, setPrefillFieldName] = useState("");

  // Conditional logic state
  const [showConditions, setShowConditions] = useState(false);
  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">("AND");
  const [conditionRules, setConditionRules] = useState<FieldCondition[]>([]);

  // Load n8n field definitions
  useEffect(() => {
    fetch("/api/n8n-fields")
      .then(res => res.json())
      .then(data => {
        if (data.fields) {
          setN8nFields(data.fields.map((f: any) => ({
            name: f.name,
            label: f.label || f.name,
          })));
        }
      })
      .catch(err => console.error("Failed to load n8n fields:", err));
  }, []);

  // Query existing form if editing
  const { data, isLoading } = db.useQuery(
    existingFormId
      ? {
          stage_forms: {
            $: { where: { id: existingFormId } },
          },
        }
      : { stage_forms: {} }
  );

  // Query the stage to get its pipe, and all forms in that pipe
  const { data: pipeData } = db.useQuery({
    stages: {
      $: { where: { id: stageId } },
      pipe: {
        stages: {
          forms: {},
        },
      },
    },
  });

  // Get all forms from all stages in the pipe
  const allFormsInPipe = pipeData?.stages?.[0]?.pipe?.stages?.flatMap((stage: any) =>
    (stage.forms || []).map((form: any) => ({
      ...form,
      stageName: stage.name,
    }))
  ) || [];

  // Load existing form data
  const existingForm = existingFormId ? data?.stage_forms?.[0] : null;

  // Initialize form data when editing (using useEffect to avoid state update issues)
  useEffect(() => {
    if (existingForm && existingFormId && !loading) {
      // Only load if we haven't loaded this form yet
      if (formName === "" && fields.length === 0) {
        setFormName(existingForm.name);
        setFormType(existingForm.formType || "client"); // Load form type
        setFields(existingForm.fields || []);
      }
    }
  }, [existingForm, existingFormId, loading, formName, fields.length]);

  const handleAddField = () => {
    // For content fields, we don't need a name
    if (fieldType !== "content" && (!fieldName || !fieldLabel)) return;
    if (fieldType === "content" && !fieldLabel) return;

    const newField: FormField = {
      id: editingField?.id || id(),
      name: fieldType === "content" ? `content_${Date.now()}` : fieldName, // Auto-generate name for content
      label: fieldLabel,
      description: fieldDescription || undefined, // Optional help text
      type: fieldType,
      required: fieldType === "content" ? false : fieldRequired, // Content fields are never required
      options: (fieldType === "select" || fieldType === "radio")
        ? fieldOptions.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined,
      content: fieldType === "content" ? fieldContent : undefined,
      acceptedFileTypes: fieldType === "file" && fieldAcceptedFileTypes ? fieldAcceptedFileTypes : undefined,
      conditions: conditionRules.length > 0 ? {
        logic: conditionLogic,
        rules: conditionRules,
      } : undefined,
      prefillFromField: prefillFormId && prefillFieldName ? (() => {
        // Find the form and field to get display names
        const selectedForm = allFormsInPipe.find((f: any) => f.id === prefillFormId);
        const selectedField = selectedForm?.fields?.find((f: any) => f.name === prefillFieldName);
        return {
          formId: prefillFormId,
          formName: selectedForm?.name || "Unknown Form",
          fieldName: prefillFieldName,
          fieldLabel: selectedField?.label || prefillFieldName,
        };
      })() : undefined,
    };

    if (editingField) {
      setFields(fields.map((f) => (f.id === editingField.id ? newField : f)));
      setEditingField(null);
    } else {
      setFields([...fields, newField]);
    }

    // Reset form
    setFieldName("");
    setFieldLabel("");
    setFieldDescription("");
    setFieldType("text");
    setFieldRequired(false);
    setFieldOptions("");
    setFieldContent("");
    setFieldAcceptedFileTypes("");
    setShowConditions(false);
    setConditionLogic("AND");
    setConditionRules([]);
    setShowPrefill(false);
    setPrefillFormId("");
    setPrefillFieldName("");
  };

  const handleEditField = (field: FormField) => {
    setEditingField(field);
    setFieldName(field.name);
    setFieldLabel(field.label);
    setFieldDescription(field.description || "");
    setFieldType(field.type);
    setFieldRequired(field.required);
    setFieldOptions(field.options?.join(", ") || "");
    setFieldContent(field.content || "");
    setFieldAcceptedFileTypes(field.acceptedFileTypes || "");
    setShowConditions(!!field.conditions && field.conditions.rules.length > 0);
    setConditionLogic(field.conditions?.logic || "AND");
    setConditionRules(field.conditions?.rules || []);
    setShowPrefill(!!field.prefillFromField);
    setPrefillFormId(field.prefillFromField?.formId || "");
    setPrefillFieldName(field.prefillFromField?.fieldName || "");
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return; // Already at top
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    setFields(newFields);
  };

  const handleMoveFieldDown = (index: number) => {
    if (index === fields.length - 1) return; // Already at bottom
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    setFields(newFields);
  };

  // Condition rule management
  const handleAddConditionRule = () => {
    setConditionRules([
      ...conditionRules,
      {
        id: id(),
        fieldName: "",
        operator: "equals",
        value: "",
      },
    ]);
  };

  const handleUpdateConditionRule = (ruleId: string, updates: Partial<FieldCondition>) => {
    setConditionRules(
      conditionRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      )
    );
  };

  const handleDeleteConditionRule = (ruleId: string) => {
    setConditionRules(conditionRules.filter((rule) => rule.id !== ruleId));
  };

  const handleSaveForm = async () => {
    if (!formName || fields.length === 0) {
      alert("Please provide a form name and at least one field");
      return;
    }

    setLoading(true);

    try {
      if (existingFormId) {
        // Update existing form
        await db.transact([
          db.tx.stage_forms[existingFormId].update({
            name: formName,
            formType: formType,
            fields: fields,
          }),
        ]);
        showToast("Form updated successfully!");
      } else {
        // Create new form
        const formId = id();
        await db.transact([
          db.tx.stage_forms[formId]
            .update({
              name: formName,
              formType: formType,
              fields: fields,
              createdAt: Date.now(),
            })
            .link({ stage: stageId }),
        ]);
        showToast("Form created successfully!");
      }
      onClose();
    } catch (error) {
      console.error("Error saving form:", error);
      alert("Failed to save form");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while fetching existing form data
  if (existingFormId && isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading form...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {existingFormId ? "Edit Form" : "Create Stage Form"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Form Name and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Form Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Client Information Form"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Form Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as "client" | "admin")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="client">Client Form (Send link to client)</option>
                <option value="admin">Admin Form (Fill within card)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formType === "client"
                  ? "Client will fill this form via a link"
                  : "Admin fills this form directly in the card"}
              </p>
            </div>
          </div>

          {/* Form Fields List */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Form Fields</h3>
            {fields.length === 0 ? (
              <p className="text-gray-500 text-sm">No fields added yet</p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    {/* Order Controls */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveFieldUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveFieldDown(index)}
                        disabled={index === fields.length - 1}
                        className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Field Info */}
                    <div className="flex-1">
                      <div className="font-medium">{field.label}</div>
                      <div className="text-sm text-gray-500">
                        {field.name} • {field.type}
                        {field.required && " • Required"}
                        {field.options && ` • Options: ${field.options.join(", ")}`}
                        {field.conditions && field.conditions.rules.length > 0 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Conditional ({field.conditions.rules.length} rule{field.conditions.rules.length > 1 ? "s" : ""})
                          </span>
                        )}
                        {field.prefillFromField && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Pre-fill: {field.prefillFromField.formName} → {field.prefillFromField.fieldLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditField(field)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit Field Form */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">
              {editingField ? "Edit Field" : "Add Field"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {fieldType !== "content" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Name (key)
                  </label>
                  <input
                    type="text"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="e.g., company_name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className={fieldType === "content" ? "col-span-2" : ""}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldType === "content" ? "Label (Section Title)" : "Field Label (display)"}
                </label>
                <input
                  type="text"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder={fieldType === "content" ? "e.g., Important Information" : "e.g., Company Name"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional Help Text)
                </label>
                <textarea
                  value={fieldDescription}
                  onChange={(e) => setFieldDescription(e.target.value)}
                  placeholder="e.g., Enter your company's legal name as it appears on official documents"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This help text will appear below the field. Supports HTML for links: <code className="bg-gray-100 px-1 rounded">&lt;a href="URL" target="_blank"&gt;Link text&lt;/a&gt;</code>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as FormField["type"])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="time">Time</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="radio">Radio Buttons</option>
                  <option value="file">File Upload</option>
                  <option value="content">Content (Display Only)</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    disabled={fieldType === "content"}
                  />
                  <span className="text-sm font-medium text-gray-700">Required field</span>
                </label>
              </div>
              {(fieldType === "select" || fieldType === "radio") && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    placeholder="e.g., Option 1, Option 2, Option 3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {fieldType === "file" && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accepted File Types (optional)
                  </label>
                  <input
                    type="text"
                    value={fieldAcceptedFileTypes}
                    onChange={(e) => setFieldAcceptedFileTypes(e.target.value)}
                    placeholder="e.g., .pdf,.jpg,.png or image/*,application/pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs font-semibold text-yellow-900 mb-2">💡 File Type Examples:</p>
                    <div className="space-y-1 text-xs text-yellow-800">
                      <div><code className="bg-white px-1 py-0.5 rounded">.pdf,.doc,.docx</code> - Documents only</div>
                      <div><code className="bg-white px-1 py-0.5 rounded">.jpg,.jpeg,.png,.gif</code> - Images only</div>
                      <div><code className="bg-white px-1 py-0.5 rounded">image/*</code> - All image types</div>
                      <div><code className="bg-white px-1 py-0.5 rounded">application/pdf</code> - PDF files using MIME type</div>
                      <div><code className="bg-white px-1 py-0.5 rounded">.pdf,image/*</code> - PDFs and all images</div>
                    </div>
                    <p className="text-xs text-yellow-700 mt-2">
                      Leave empty to accept all file types. Use extensions (.pdf) or MIME types (application/pdf).
                    </p>
                  </div>
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-900 mb-1">⚠️ File Size Limit</p>
                    <p className="text-xs text-red-800">
                      Maximum file size is <strong>2MB</strong>. Files larger than this will be rejected during upload.
                      This limit ensures reliable form submissions and database performance.
                    </p>
                  </div>
                </div>
              )}
              {fieldType === "content" && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content (HTML/Rich Text)
                  </label>
                  <RichTextEditor
                    value={fieldContent}
                    onChange={setFieldContent}
                    placeholder="Enter content to display in the form..."
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-2">💡 Click to Insert Placeholders:</p>

                    {/* Card & System Placeholders */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-blue-800 mb-1">Card & System:</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setFieldContent(fieldContent + "{{card_title}}")}
                          className="text-xs px-2 py-1 bg-white hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                        >
                          + card_title
                        </button>
                        <button
                          type="button"
                          onClick={() => setFieldContent(fieldContent + "{{stage_name}}")}
                          className="text-xs px-2 py-1 bg-white hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                        >
                          + stage_name
                        </button>
                        <button
                          type="button"
                          onClick={() => setFieldContent(fieldContent + "{{pipe_name}}")}
                          className="text-xs px-2 py-1 bg-white hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                        >
                          + pipe_name
                        </button>
                        <button
                          type="button"
                          onClick={() => setFieldContent(fieldContent + "{{current_date}}")}
                          className="text-xs px-2 py-1 bg-white hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                        >
                          + current_date
                        </button>
                      </div>
                    </div>

                    {/* n8n Field Placeholders */}
                    {n8nFields.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-blue-800 mb-1">Card Fields (from n8n):</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {n8nFields.map((field) => (
                            <button
                              key={field.name}
                              type="button"
                              onClick={() => setFieldContent(fieldContent + `{{${field.name}}}`)}
                              className="text-xs px-2 py-1 bg-white hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                              title={field.label}
                            >
                              + {field.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Form Field Placeholders */}
                    {allFormsInPipe.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-blue-800 mb-1">Form Fields (from other forms):</p>
                        <div className="space-y-2 text-xs text-blue-800 max-h-40 overflow-y-auto">
                          {allFormsInPipe.map((form: any) => (
                            <div key={form.id} className="bg-white p-2 rounded border border-blue-100">
                              <div className="font-semibold mb-1">{form.name}:</div>
                              <div className="flex flex-wrap gap-2 pl-2">
                                {form.fields?.filter((f: any) => f.type !== "content").map((field: any) => (
                                  <button
                                    key={field.id}
                                    type="button"
                                    onClick={() => setFieldContent(fieldContent + `{{form:${form.name}.${field.name}}}`)}
                                    className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                                    title={field.label}
                                  >
                                    + form:{form.name}.{field.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-blue-700 mt-2">
                      These placeholders will be replaced with actual values when the form is displayed.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Conditional Logic Section */}
            <div className="mt-6 border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-md font-semibold text-gray-900">Conditional Logic</h4>
                  <p className="text-sm text-gray-600">Show this field only when certain conditions are met</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowConditions(!showConditions);
                    if (showConditions) {
                      // Clear conditions when hiding
                      setConditionRules([]);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg ${
                    showConditions
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {showConditions ? "Hide Conditions" : "Add Conditions"}
                </button>
              </div>

              {showConditions && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  {/* Logic Selector */}
                  {conditionRules.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logic Type
                      </label>
                      <select
                        value={conditionLogic}
                        onChange={(e) => setConditionLogic(e.target.value as "AND" | "OR")}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="AND">AND (all conditions must be true)</option>
                        <option value="OR">OR (any condition can be true)</option>
                      </select>
                    </div>
                  )}

                  {/* Condition Rules */}
                  <div className="space-y-3">
                    {conditionRules.length === 0 ? (
                      <p className="text-sm text-gray-500">No conditions added yet. Click "Add Condition" to get started.</p>
                    ) : (
                      conditionRules.map((rule, index) => (
                        <div key={rule.id} className="flex items-start gap-2 bg-white p-3 rounded border border-gray-200">
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            {/* Field Selector */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Field
                              </label>
                              <select
                                value={rule.fieldName}
                                onChange={(e) =>
                                  handleUpdateConditionRule(rule.id, { fieldName: e.target.value })
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select field...</option>
                                {fields
                                  .filter((f) => f.type !== "content") // Content fields can't be used in conditions
                                  .map((f) => (
                                    <option key={f.id} value={f.name}>
                                      {f.label}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Operator Selector */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Operator
                              </label>
                              <select
                                value={rule.operator}
                                onChange={(e) =>
                                  handleUpdateConditionRule(rule.id, {
                                    operator: e.target.value as FieldCondition["operator"],
                                  })
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="equals">equals</option>
                                <option value="notEquals">not equals</option>
                                <option value="contains">contains</option>
                                <option value="isFilled">is filled</option>
                                <option value="isEmpty">is empty</option>
                              </select>
                            </div>

                            {/* Value Input (hidden for isFilled/isEmpty) */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Value
                              </label>
                              {rule.operator === "isFilled" || rule.operator === "isEmpty" ? (
                                <input
                                  type="text"
                                  value="(not needed)"
                                  disabled
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100 text-gray-500"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={rule.value || ""}
                                  onChange={(e) =>
                                    handleUpdateConditionRule(rule.id, { value: e.target.value })
                                  }
                                  placeholder="Enter value..."
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              )}
                            </div>
                          </div>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteConditionRule(rule.id)}
                            className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded mt-5"
                            title="Remove condition"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Condition Button */}
                  <button
                    type="button"
                    onClick={handleAddConditionRule}
                    className="w-full px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                  >
                    + Add Condition
                  </button>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs text-blue-800">
                      <strong>How it works:</strong> This field will only be shown when the conditions above are met.
                      If you have multiple conditions, they will be evaluated using the logic type you selected.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Pre-fill from Previous Form Section */}
            {fieldType !== "content" && fieldType !== "file" && (
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-md font-semibold text-gray-900">Pre-fill from Previous Form</h4>
                    <p className="text-sm text-gray-600">Auto-fill this field with answers from a previous form</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrefill(!showPrefill);
                      if (showPrefill) {
                        // Clear prefill when hiding
                        setPrefillFormId("");
                        setPrefillFieldName("");
                      }
                    }}
                    className={`px-4 py-2 rounded-lg ${
                      showPrefill
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {showPrefill ? "Disable Pre-fill" : "Enable Pre-fill"}
                  </button>
                </div>

                {showPrefill && (
                  <div className="space-y-4 bg-green-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Form Selector */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Source Form
                        </label>
                        <select
                          value={prefillFormId}
                          onChange={(e) => {
                            setPrefillFormId(e.target.value);
                            setPrefillFieldName(""); // Reset field when form changes
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        >
                          <option value="">Select a form...</option>
                          {allFormsInPipe.map((form: any) => (
                            <option key={form.id} value={form.id}>
                              {form.name} {form.stageName ? `(${form.stageName})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Field Selector */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Source Field
                        </label>
                        <select
                          value={prefillFieldName}
                          onChange={(e) => setPrefillFieldName(e.target.value)}
                          disabled={!prefillFormId}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value="">Select a field...</option>
                          {prefillFormId &&
                            allFormsInPipe
                              .find((f: any) => f.id === prefillFormId)
                              ?.fields?.filter((f: any) => f.type !== "content")
                              .map((field: any) => (
                                <option key={field.id} value={field.name}>
                                  {field.label} ({field.type})
                                </option>
                              ))}
                        </select>
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-white border border-green-300 rounded p-3">
                      <p className="text-xs text-green-900">
                        <strong>How it works:</strong> When this form is displayed, this field will be pre-filled
                        with the most recent answer from the selected field in the source form. The user can still
                        edit or change the pre-filled value.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddField}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingField ? "Update Field" : "Add Field"}
              </button>
              {editingField && (
                <button
                  onClick={() => {
                    setEditingField(null);
                    setFieldName("");
                    setFieldLabel("");
                    setFieldType("text");
                    setFieldRequired(false);
                    setFieldOptions("");
                    setShowConditions(false);
                    setConditionRules([]);
                    setShowPrefill(false);
                    setPrefillFormId("");
                    setPrefillFieldName("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Save Form Button */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveForm}
            disabled={!formName || fields.length === 0 || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : existingFormId ? "Update Form" : "Save Form"}
          </button>
        </div>
      </div>
    </div>
  );
}
