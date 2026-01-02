"use client";

import { db } from "@/lib/db";
import { useState, useEffect } from "react";
import { id } from "@instantdb/react";

type CardField = {
  id: string;
  key: string;
  type: string;
  value: any;
};

type Card = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  fields?: CardField[];
};

type CardModalProps = {
  card: Card;
  onClose: () => void;
};

export function CardModal({ card, onClose }: CardModalProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(card.description || "");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [showAddField, setShowAddField] = useState(false);

  // Email functionality
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "success" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  // Form functionality
  const [showFormModal, setShowFormModal] = useState(false);
  const [showFormSubmissions, setShowFormSubmissions] = useState(false);
  const [sendingFormLink, setSendingFormLink] = useState(false);

  // Load email templates
  useEffect(() => {
    fetch("/api/email-templates")
      .then(res => res.json())
      .then(data => {
        if (data.templates) {
          setEmailTemplates(data.templates);
        }
      })
      .catch(err => console.error("Failed to load email templates:", err));
  }, []);

  // Query card with fields and emails
  const { data } = db.useQuery({
    cards: {
      $: { where: { id: card.id } },
      fields: {},
      emails: {},
      form_submissions: {
        form: {},
      },
      stage: {
        forms: {},
      },
    },
  });

  const cardData = data?.cards?.[0];
  const fields = (cardData?.fields || []).sort((a: any, b: any) => {
    // Sort by position if available, otherwise maintain original order
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return 0;
  });

  // Sort emails by sentAt (newest first)
  const emails = (cardData?.emails || []).sort((a: any, b: any) => b.sentAt - a.sentAt);

  // Get form submissions sorted by date
  const formSubmissions = (cardData?.form_submissions || []).sort((a: any, b: any) => b.submittedAt - a.submittedAt);

  // Get forms available for this stage
  const availableForms = (cardData?.stage?.forms || []);

  const handleUpdateTitle = async () => {
    if (title.trim() === card.title) {
      setIsEditingTitle(false);
      return;
    }

    await db.transact([
      db.tx.cards[card.id].update({
        title: title.trim(),
        updatedAt: Date.now(),
      }),
    ]);
    setIsEditingTitle(false);
  };

  const handleUpdateDescription = async () => {
    if (description === card.description) {
      setIsEditingDescription(false);
      return;
    }

    await db.transact([
      db.tx.cards[card.id].update({
        description: description,
        updatedAt: Date.now(),
      }),
    ]);
    setIsEditingDescription(false);
  };

  const handleAddField = async () => {
    if (!newFieldKey.trim()) return;

    const fieldId = id();
    let processedValue: any = newFieldValue;

    // Process value based on type
    if (newFieldType === "number") {
      processedValue = parseFloat(newFieldValue) || 0;
    } else if (newFieldType === "date") {
      processedValue = new Date(newFieldValue).getTime();
    }

    // Set position to the end of the current list
    const maxPosition = fields.length > 0
      ? Math.max(...fields.map((f: any) => f.position ?? 0))
      : -1;

    await db.transact([
      db.tx.card_fields[fieldId].update({
        key: newFieldKey.trim(),
        type: newFieldType,
        value: processedValue,
        position: maxPosition + 1,
      }).link({ card: card.id }),
    ]);

    setNewFieldKey("");
    setNewFieldValue("");
    setShowAddField(false);
  };

  const handleUpdateField = async (fieldId: string, value: any, type: string) => {
    let processedValue = value;

    if (type === "number") {
      processedValue = parseFloat(value) || 0;
    } else if (type === "date") {
      processedValue = new Date(value).getTime();
    }

    await db.transact([
      db.tx.card_fields[fieldId].update({
        value: processedValue,
      }),
    ]);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Delete this field?")) return;

    await db.transact([
      db.tx.card_fields[fieldId].delete(),
    ]);
  };

  const handleDeleteCard = async () => {
    if (!confirm("Are you sure you want to delete this card? This action cannot be undone.")) return;

    await db.transact([
      db.tx.cards[card.id].delete(),
    ]);

    onClose();
  };

  // Email functions
  const replacePlaceholders = (text: string) => {
    let result = text;

    // Replace {{title}}
    result = result.replace(/\{\{title\}\}/g, card.title);

    // Replace field placeholders
    fields.forEach((field: any) => {
      const placeholder = new RegExp(`\\{\\{${field.key}\\}\\}`, 'g');
      result = result.replace(placeholder, field.value || '');
    });

    return result;
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setEmailSubject(replacePlaceholders(template.subject));
      setEmailBody(replacePlaceholders(template.body));
    }
  };

  const handleSendEmail = async () => {
    // Get email from '電郵' field
    const emailField = fields.find((f: any) => f.key === '電郵');
    const recipientEmail = emailField?.value;

    if (!recipientEmail) {
      alert("No email address found in '電郵' field");
      return;
    }

    if (!emailSubject || !emailBody) {
      alert("Please fill in subject and body");
      return;
    }

    setSendingEmail(true);
    setEmailStatus("idle");
    setEmailError("");

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "system",
          to: recipientEmail,
          subject: emailSubject,
          body: emailBody,
          cardId: card.id,
          cardData: {
            title: card.title,
            fields: fields.reduce((acc: any, f: any) => {
              acc[f.key] = f.value;
              return acc;
            }, {})
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        throw new Error(errorData.error || errorData.message || "Failed to send email");
      }

      setEmailStatus("success");
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSubject("");
        setEmailBody("");
        setSelectedTemplate("");
        setEmailStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Failed to send email:", error);
      setEmailStatus("error");
      setEmailError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendFormLink = async (formId: string, formName: string) => {
    // Get email from '電郵' field
    const emailField = fields.find((f: any) => f.key === '電郵');
    const recipientEmail = emailField?.value;

    if (!recipientEmail) {
      alert("No email address found in '電郵' field");
      return;
    }

    setSendingFormLink(true);

    try {
      const response = await fetch("/api/send-form-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          formId,
          recipientEmail,
          formName,
          cardTitle: card.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send form link");
      }

      alert("Form link sent successfully!");
      setShowFormModal(false);
    } catch (error) {
      console.error("Failed to send form link:", error);
      alert(`Failed to send form link: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSendingFormLink(false);
    }
  };

  const renderFieldInput = (field: CardField) => {
    switch (field.type) {
      case "number":
        return (
          <input
            type="number"
            defaultValue={field.value}
            onBlur={(e) => handleUpdateField(field.id, e.target.value, field.type)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        );
      case "date":
        return (
          <input
            type="date"
            defaultValue={new Date(field.value).toISOString().split("T")[0]}
            onChange={(e) => handleUpdateField(field.id, e.target.value, field.type)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        );
      case "select":
        return (
          <input
            type="text"
            defaultValue={field.value}
            onBlur={(e) => handleUpdateField(field.id, e.target.value, field.type)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="Option value"
          />
        );
      case "file":
        return (
          <div className="flex items-center gap-2">
            <input
              type="url"
              defaultValue={field.value}
              onBlur={(e) => handleUpdateField(field.id, e.target.value, field.type)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="File URL"
            />
            {field.value && (
              <a
                href={field.value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View
              </a>
            )}
          </div>
        );
      default: // text
        return (
          <input
            type="text"
            defaultValue={field.value}
            onBlur={(e) => handleUpdateField(field.id, e.target.value, field.type)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Title */}
          <div className="flex justify-between items-start mb-6">
            {isEditingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleUpdateTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateTitle();
                  if (e.key === "Escape") {
                    setTitle(card.title);
                    setIsEditingTitle(false);
                  }
                }}
                className="flex-1 text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none"
                autoFocus
              />
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
              >
                {card.title}
              </h2>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl ml-4"
            >
              ×
            </button>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            {isEditingDescription ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleUpdateDescription}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Add a description..."
              />
            ) : (
              <p
                onClick={() => setIsEditingDescription(true)}
                className="text-gray-600 cursor-pointer hover:bg-gray-50 p-2 rounded min-h-[60px]"
              >
                {card.description || "Click to add a description..."}
              </p>
            )}
          </div>

          {/* Custom Fields */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Custom Fields</h3>
              <button
                onClick={() => setShowAddField(!showAddField)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAddField ? "Cancel" : "+ Add Field"}
              </button>
            </div>

            {/* Add Field Form */}
            {showAddField && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    placeholder="Field name (e.g., Priority)"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="file">File URL</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type={newFieldType === "date" ? "date" : newFieldType === "number" ? "number" : "text"}
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <button
                    onClick={handleAddField}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Fields List */}
            <div className="space-y-3">
              {fields.length > 0 ? (
                fields.map((field: CardField) => (
                  <div key={field.id} className="flex items-start gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.key}
                        <span className="ml-2 text-xs text-gray-500">({field.type})</span>
                      </label>
                      {renderFieldInput(field)}
                    </div>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="mt-6 text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No custom fields yet. Add one above!</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="text-sm text-gray-500 pt-4 border-t">
            <p>Created: {new Date(card.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(card.updatedAt).toLocaleString()}</p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t mt-4 flex gap-2">
            <button
              onClick={() => setShowMailbox(true)}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors relative"
            >
              📬 Mailbox
              {emails.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                  {emails.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📧 Send Email
            </button>
            <button
              onClick={() => setShowFormModal(true)}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              📝 Send Form
            </button>
            <button
              onClick={() => setShowFormSubmissions(true)}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors relative"
            >
              📋 Submissions
              {formSubmissions.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                  {formSubmissions.length}
                </span>
              )}
            </button>
            <button
              onClick={handleDeleteCard}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Card
            </button>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Send Email</h2>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Recipient */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To (from '電郵' field)
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                  {fields.find((f: any) => f.key === '電郵')?.value || <span className="text-red-600">No email address found</span>}
                </div>
              </div>

              {/* Template Selector */}
              {emailTemplates.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Use Template (Optional)
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a template --</option>
                    {emailTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject"
                />
              </div>

              {/* Body */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Email body..."
                />
              </div>

              {/* Status Messages */}
              {emailStatus === "success" && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
                  ✅ Email sent successfully!
                </div>
              )}
              {emailStatus === "error" && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <div className="font-semibold">❌ Failed to send email</div>
                  {emailError && (
                    <div className="text-sm mt-1">{emailError}</div>
                  )}
                  <div className="text-xs mt-2 text-red-600">
                    Check: n8n workflow is running, webhook URL is correct, and SMTP credentials are valid
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailSubject || !emailBody}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? "Sending..." : "Send Email"}
                </button>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mailbox Modal */}
      {showMailbox && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Mailbox - {card.title}</h2>
                <button
                  onClick={() => {
                    setShowMailbox(false);
                    setSelectedEmail(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {emails.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-4">📭</p>
                  <p>No emails yet</p>
                  <p className="text-sm mt-2">Sent and received emails will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((email: any) => (
                    <div
                      key={email.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            email.direction === "sent"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}>
                            {email.direction === "sent" ? "📤 Sent" : "📥 Received"}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(email.sentAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="mb-1">
                        <span className="text-sm text-gray-600">
                          {email.direction === "sent" ? "To: " : "From: "}
                        </span>
                        <span className="text-sm font-medium">
                          {email.direction === "sent" ? email.to : email.from}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 mb-1">{email.subject}</p>
                      <p className="text-sm text-gray-600 truncate">{email.body.substring(0, 100)}...</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => setShowMailbox(false)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm rounded ${
                    selectedEmail.direction === "sent"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-green-100 text-green-800"
                  }`}>
                    {selectedEmail.direction === "sent" ? "📤 Sent" : "📥 Received"}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(selectedEmail.sentAt).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-4 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{selectedEmail.subject}</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-gray-600">From: </span>
                    <span className="font-medium">{selectedEmail.from}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">To: </span>
                    <span className="font-medium">{selectedEmail.to}</span>
                  </div>
                  {selectedEmail.emailId && (
                    <div>
                      <span className="text-gray-600">Email ID: </span>
                      <span className="text-xs font-mono text-gray-500">{selectedEmail.emailId}</span>
                    </div>
                  )}
                  {selectedEmail.inReplyTo && (
                    <div>
                      <span className="text-gray-600">In Reply To: </span>
                      <span className="text-xs font-mono text-gray-500">{selectedEmail.inReplyTo}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <pre className="whitespace-pre-wrap font-sans text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedEmail.body}
                </pre>
              </div>

              <div className="flex gap-2">
                {selectedEmail.direction === "received" && (
                  <button
                    onClick={() => {
                      setSelectedEmail(null);
                      setShowMailbox(false);
                      setShowEmailModal(true);
                      setEmailSubject(`Re: ${selectedEmail.subject}`);
                      setEmailBody(`\n\n---\nOn ${new Date(selectedEmail.sentAt).toLocaleString()}, ${selectedEmail.from} wrote:\n${selectedEmail.body}`);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ↩️ Reply
                  </button>
                )}
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Back to Mailbox
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Send Form to Client</h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Recipient */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To (from '電郵' field)
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                  {fields.find((f: any) => f.key === '電郵')?.value || <span className="text-red-600">No email address found</span>}
                </div>
              </div>

              {/* Available Forms */}
              {availableForms.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-4">📝</p>
                  <p>No forms available for this stage</p>
                  <p className="text-sm mt-2">Create a form for this stage first</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select a form to send:
                  </label>
                  {availableForms.map((form: any) => (
                    <div
                      key={form.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{form.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {form.fields?.length || 0} fields
                          </p>
                        </div>
                        <button
                          onClick={() => handleSendFormLink(form.id, form.name)}
                          disabled={sendingFormLink || !fields.find((f: any) => f.key === '電郵')?.value}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingFormLink ? "Sending..." : "Send Link"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowFormModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Submissions Modal */}
      {showFormSubmissions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Form Submissions - {card.title}</h2>
                <button
                  onClick={() => setShowFormSubmissions(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {formSubmissions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-4">📋</p>
                  <p>No form submissions yet</p>
                  <p className="text-sm mt-2">Client form responses will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formSubmissions.map((submission: any) => (
                    <div
                      key={submission.id}
                      className="border border-gray-200 rounded-lg p-4 bg-white"
                    >
                      <div className="flex items-start justify-between mb-3 pb-3 border-b">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {submission.form?.name || "Form Response"}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Submitted: {new Date(submission.submittedAt).toLocaleString()}
                          </p>
                          {submission.submitterEmail && (
                            <p className="text-sm text-gray-500">
                              From: {submission.submitterEmail}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(submission.responses || {}).map(([key, value]: [string, any]) => (
                          <div key={key} className="bg-gray-50 p-3 rounded">
                            <div className="text-sm font-medium text-gray-700 mb-1">{key}</div>
                            <div className="text-gray-900">
                              {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => setShowFormSubmissions(false)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
