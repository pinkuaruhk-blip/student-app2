"use client";

import { db } from "@/lib/db";
import { useState, useEffect, useRef } from "react";
import { id } from "@instantdb/react";
import { replacePlaceholders } from "@/lib/placeholders";
import { checkAndExecuteAutomations } from "@/lib/automation-engine-client";
import { RichTextEditor, RichTextEditorRef } from "./rich-text-editor";
import { useToast } from "@/contexts/toast-context";
import { useTranslations } from 'next-intl';

type Card = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
};

type CardModalProps = {
  card: Card;
  onClose: () => void;
};

type TabType = "details" | "emails" | "sms" | "history" | "comments" | "activities";

export function CardModalNew({ card, onClose }: CardModalProps) {
  const t = useTranslations('card');
  const tCommon = useTranslations('common');
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [title, setTitle] = useState(card.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [description, setDescription] = useState(card.description || "");
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Field management
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [showAddField, setShowAddField] = useState(false);
  const [isEditingFields, setIsEditingFields] = useState(false);

  // Email state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailFromEmail, setEmailFromEmail] = useState<string | undefined>(undefined);
  const [emailFromName, setEmailFromName] = useState<string | undefined>(undefined);
  const [emailCc, setEmailCc] = useState<string | undefined>(undefined);
  const [emailBcc, setEmailBcc] = useState<string | undefined>(undefined);
  const [emailTo, setEmailTo] = useState<string>("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "success" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const composeEmailRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichTextEditorRef>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [emailComposeView, setEmailComposeView] = useState<'inline' | 'popup'>('inline');

  // SMS state
  const [smsTo, setSmsTo] = useState<string>("");
  const [smsBody, setSmsBody] = useState<string>("");
  const [sendingSms, setSendingSms] = useState(false);
  const [expandedSmsId, setExpandedSmsId] = useState<string | null>(null);
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState<string>("");

  // Form state
  const [sendingFormLink, setSendingFormLink] = useState(false);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [submissionResponses, setSubmissionResponses] = useState<Record<string, any>>({});

  // Admin form filling state
  const [fillingFormId, setFillingFormId] = useState<string | null>(null);
  const [adminFormResponses, setAdminFormResponses] = useState<Record<string, any>>({});
  const [submittingAdminForm, setSubmittingAdminForm] = useState(false);

  // History state
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Kebab menu state
  const [showKebabMenu, setShowKebabMenu] = useState(false);

  // Historical forms state
  const [showHistoricalForms, setShowHistoricalForms] = useState(false);

  // Client form preview state - auto-expand first form
  const [expandedClientFormId, setExpandedClientFormId] = useState<string | null>(null);

  // Client form editing state
  const [editingClientFormId, setEditingClientFormId] = useState<string | null>(null);
  const [clientFormResponses, setClientFormResponses] = useState<Record<string, any>>({});

  // Comments state
  const [commentBody, setCommentBody] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // Get current user for comment author
  const { user } = db.useAuth();

  // Query card with all related data
  const { data } = db.useQuery({
    cards: {
      $: { where: { id: card.id } },
      fields: {},
      emails: {},
      sms: {},
      comments: {},
      form_submissions: {
        form: {},
      },
      history: {},
      automation_logs: {
        automation: {},
      },
      stage: {
        forms: {},
        pipe: {
          email_templates: {},
          sms_templates: {},
        },
      },
    },
    system_settings: {},
  });

  const cardData = data?.cards?.[0];
  const fields = (cardData?.fields || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  const emails = (cardData?.emails || []).sort((a: any, b: any) => b.sentAt - a.sentAt);
  const smsMessages = (cardData?.sms || []).sort((a: any, b: any) => b.sentAt - a.sentAt);
  const comments = (cardData?.comments || []).sort((a: any, b: any) => b.createdAt - a.createdAt);
  const formSubmissions = (cardData?.form_submissions || []).sort((a: any, b: any) => b.submittedAt - a.submittedAt);
  const availableForms = (cardData?.stage?.forms || []);
  const stageHistory = (cardData?.history || []);
  const automationLogs = (cardData?.automation_logs || []);
  const systemSettings = data?.system_settings?.[0];
  const currentStage = cardData?.stage;
  const emailTemplates = currentStage?.pipe?.email_templates || [];
  const smsTemplates = currentStage?.pipe?.sms_templates || [];

  // Function to build default email subject
  const buildDefaultSubject = () => {
    const globalVariables = systemSettings?.globalVariables || [];
    const globalYear = globalVariables.find((v: any) => v.name === "global_year")?.value || "";
    const schoolNameField = fields.find((f: any) => f.key === "學校全名");
    const schoolName = schoolNameField?.value || "";

    // Build subject with conditional parts (Card ID is added automatically by API)
    const parts = [];
    if (globalYear) {
      parts.push(`${globalYear}年度 手作之店 / pinkuaru 學生優惠計劃`);
    }
    if (schoolName) {
      parts.push(schoolName);
    }

    return parts.filter(p => p).join(" - ");
  };

  // Count unread received emails
  const unreadReceivedCount = emails.filter((e: any) => e.direction === "received" && !e.read).length;

  // Combine stage history and automation logs into a unified timeline
  const history = [
    ...stageHistory.map((item: any) => ({
      ...item,
      type: "stage_move",
      timestamp: item.movedAt,
    })),
    ...automationLogs
      .filter((log: any) => log.status !== "skipped") // Filter out skipped automations
      .map((log: any) => ({
        ...log,
        type: "automation",
        timestamp: log.executedAt,
      })),
  ].sort((a: any, b: any) => b.timestamp - a.timestamp);

  // Separate current stage submissions from historical ones
  const currentStageFormIds = availableForms.map((f: any) => f.id);
  const currentStageSubmissions = formSubmissions.filter((sub: any) =>
    currentStageFormIds.includes(sub.form?.id)
  );
  const historicalSubmissions = formSubmissions.filter((sub: any) =>
    !currentStageFormIds.includes(sub.form?.id)
  );

  // Separate admin forms from client forms
  const adminForms = availableForms.filter((f: any) => f.formType === "admin");
  const clientForms = availableForms.filter((f: any) => f.formType !== "admin");

  // Auto-expand first client form on mount (only once)
  useEffect(() => {
    if (clientForms.length > 0 && expandedClientFormId === null) {
      setExpandedClientFormId(clientForms[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientForms.length]);

  // Auto-populate SMS 'to' field when SMS tab opens
  useEffect(() => {
    if (activeTab === "sms" && !smsTo) {
      // Search for phone number field in card fields
      const phoneFieldNames = ['電話', 'Phone', 'Mobile', '手機', 'phone', 'mobile', '电话', 'Tel', 'Telephone', 'Contact'];
      const phoneField = fields.find((f: any) =>
        phoneFieldNames.some(name => f.key.toLowerCase().includes(name.toLowerCase()))
      );

      if (phoneField && phoneField.value) {
        setSmsTo(phoneField.value);
      }
    }
  }, [activeTab, fields, smsTo]);

  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const kebabContainer = document.getElementById('kebab-menu-container');
      if (showKebabMenu && kebabContainer && !kebabContainer.contains(target)) {
        setShowKebabMenu(false);
      }
    };

    if (showKebabMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showKebabMenu]);

  // Helper function to get pre-filled values for a form
  const getPrefillValues = (form: any): Record<string, any> => {
    const prefillValues: Record<string, any> = {};

    if (!form.fields) return prefillValues;

    for (const field of form.fields) {
      if (field.prefillFromField) {
        const { formId, fieldName } = field.prefillFromField;

        // Find the most recent submission of the source form
        const sourceSubmission = formSubmissions.find((sub: any) => sub.form?.id === formId);

        if (sourceSubmission && sourceSubmission.responses && sourceSubmission.responses[fieldName]) {
          prefillValues[field.name] = sourceSubmission.responses[fieldName];
        }
      }
    }

    return prefillValues;
  };

  // Handler for starting to fill an admin form
  const handleStartFillingForm = (form: any) => {
    const prefillValues = getPrefillValues(form);
    setAdminFormResponses(prefillValues);
    setFillingFormId(form.id);
  };

  // Auto-expand first admin form on mount if available
  useEffect(() => {
    if (adminForms.length > 0 && fillingFormId === null) {
      const firstForm = adminForms[0];
      // Get pre-filled values for the first form
      const prefillValues = getPrefillValues(firstForm);
      setAdminFormResponses(prefillValues);
      setFillingFormId(firstForm.id);
    }
  }, [adminForms.length]);

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

    if (newFieldType === "number") {
      processedValue = parseFloat(newFieldValue) || 0;
    } else if (newFieldType === "date") {
      processedValue = new Date(newFieldValue).getTime();
    }

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

    // Trigger automations for card field value change
    const field = fields.find((f: any) => f.id === fieldId);
    if (field && cardData?.stage?.pipe?.id) {
      try {
        console.log("🤖 Triggering automation for field change...", {
          cardId: card.id,
          pipeId: cardData.stage.pipe.id,
          fieldKey: field.key,
          fieldValue: processedValue,
        });

        const automationResult = await checkAndExecuteAutomations({
          triggerType: "card_field_value",
          cardId: card.id,
          pipeId: cardData.stage.pipe.id,
          context: {
            fieldKey: field.key,
            fieldValue: processedValue,
          },
        });

        console.log("✅ Field change automation executed:", automationResult);
      } catch (error) {
        console.error("❌ Error triggering automations:", error);
        // Don't fail the field update if automation fails
      }
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Delete this field?")) return;

    await db.transact([
      db.tx.card_fields[fieldId].delete(),
    ]);
  };

  // Email functions
  const handleSelectTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);

      // Set template metadata
      setEmailFromEmail(template.fromEmail || undefined);
      setEmailFromName(template.fromName || undefined);
      setEmailCc(template.cc || undefined);
      setEmailBcc(template.bcc || undefined);

      const processedSubject = replacePlaceholders(template.subject, {
        card: {
          title: card.title,
          description: card.description,
          fields: fields,
        },
        stage: {
          name: currentStage?.name,
        },
        pipe: {
          name: currentStage?.pipe?.name,
        },
        formSubmissions: formSubmissions,
        globalVariables: systemSettings?.globalVariables || [],
        clientForms: clientForms,
        cardId: card.id,
      });
      const processedBody = replacePlaceholders(template.body, {
        card: {
          title: card.title,
          description: card.description,
          fields: fields,
        },
        stage: {
          name: currentStage?.name,
        },
        pipe: {
          name: currentStage?.pipe?.name,
        },
        formSubmissions: formSubmissions,
        globalVariables: systemSettings?.globalVariables || [],
        clientForms: clientForms,
        cardId: card.id,
      });
      setEmailSubject(processedSubject);
      setEmailBody(processedBody);
    }
  };

  const handleSelectSmsTemplate = (templateId: string) => {
    const template = smsTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedSmsTemplate(templateId);

      const processedBody = replacePlaceholders(template.body, {
        card: {
          title: card.title,
          description: card.description,
          fields: fields,
        },
        stage: {
          name: currentStage?.name,
        },
        pipe: {
          name: currentStage?.pipe?.name,
        },
        formSubmissions: formSubmissions,
        globalVariables: systemSettings?.globalVariables || [],
        clientForms: clientForms,
        cardId: card.id,
      });
      setSmsBody(processedBody);
    }
  };

  // Helper function to split email body into latest reply and previous replies
  const splitEmailBody = (body: string) => {
    const hrIndex = body.indexOf('<hr>');
    if (hrIndex === -1) {
      // No <hr> found, show entire email
      return { latestReply: body, previousReplies: null };
    }
    return {
      latestReply: body.substring(0, hrIndex),
      previousReplies: body.substring(hrIndex),
    };
  };

  // Helper function to extract clean email addresses from formatted strings
  const extractEmailAddresses = (emailString: string): string => {
    if (!emailString) return "";

    // Split by comma for multiple emails
    const emails = emailString.split(',').map(e => e.trim());

    // Extract email from format: "Display Name" <email@example.com>
    const cleanedEmails = emails.map(email => {
      const match = email.match(/<([^>]+)>/);
      return match ? match[1] : email;
    });

    return cleanedEmails.join(', ');
  };

  // Helper function to remove card ID from subject line
  // Card ID format: "[#cardId]" added by API
  const removeCardIdFromSubject = (subject: string): string => {
    // Remove pattern like " [#abc123]" from end of subject
    return subject.replace(/\s*\[#[^\]]+\]\s*$/g, '').trim();
  };

  // Helper function to extract display name from email string
  const extractDisplayName = (emailString: string): string => {
    if (!emailString) return "";

    // Check if format is: "Name" <email@example.com> or Name <email@example.com>
    const match = emailString.match(/^"?([^"<]+)"?\s*<?/);
    if (match && match[1]) {
      return match[1].trim();
    }

    // If no name found, return the email address
    return emailString.trim();
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      alert("Please enter a recipient email address");
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
          from: emailFromEmail || undefined,
          fromName: emailFromName || undefined,
          to: emailTo,
          cc: emailCc || undefined,
          bcc: emailBcc || undefined,
          subject: emailSubject,
          body: emailBody,
          cardId: card.id,
          cardData: {
            title: card.title,
            fields: fields,
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
        setShowEmailCompose(false);
        setEmailTo("");
        setEmailSubject("");
        setEmailBody("");
        setSelectedTemplate("");
        setEmailFromEmail(undefined);
        setEmailFromName(undefined);
        setEmailCc(undefined);
        setEmailBcc(undefined);
        setShowCc(false);
        setShowBcc(false);
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

  const handleSendSms = async () => {
    if (!smsTo) {
      showToast("Please enter a recipient phone number", "error");
      return;
    }

    if (!smsBody) {
      showToast("Please enter a message", "error");
      return;
    }

    // Character limit warning
    if (smsBody.length > 160) {
      if (!confirm(`Your message is ${smsBody.length} characters. Messages over 160 characters may be split into multiple SMS. Continue?`)) {
        return;
      }
    }

    setSendingSms(true);

    try {
      const response = await fetch("/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: smsTo,
          body: smsBody,
          cardId: card.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        throw new Error(errorData.error || errorData.message || "Failed to send SMS");
      }

      showToast("SMS sent successfully!", "success");

      // Clear form
      setSmsTo("");
      setSmsBody("");
    } catch (error) {
      console.error("Failed to send SMS:", error);
      showToast(error instanceof Error ? error.message : "Failed to send SMS", "error");
    } finally {
      setSendingSms(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) {
      showToast("Please enter a comment", "error");
      return;
    }

    if (!user?.email) {
      showToast("You must be signed in to comment", "error");
      return;
    }

    setAddingComment(true);

    try {
      const commentId = id();
      const now = Date.now();

      await db.transact([
        db.tx.card_comments[commentId]
          .update({
            author: user.email,
            body: commentBody.trim(),
            createdAt: now,
          })
          .link({ card: card.id }),
      ]);

      showToast("Comment added successfully!", "success");
      setCommentBody("");
    } catch (error) {
      console.error("Failed to add comment:", error);
      showToast("Failed to add comment", "error");
    } finally {
      setAddingComment(false);
    }
  };

  const handleSendFormLink = async (formId: string, formName: string) => {
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

      showToast("Form link sent successfully!");
    } catch (error) {
      console.error("Failed to send form link:", error);
      alert(`Failed to send form link: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSendingFormLink(false);
    }
  };

  const handleEmailClick = async (email: any) => {
    // Mark as read if it's a received email and not already read
    if (email.direction === "received" && !email.read) {
      try {
        await db.transact([
          db.tx.card_emails[email.id].update({
            read: true,
          }),
        ]);
      } catch (error) {
        console.error("Failed to mark email as read:", error);
      }
    }
    // Toggle expansion: if already expanded, collapse it; otherwise expand it
    setExpandedEmailId(expandedEmailId === email.id ? null : email.id);
  };

  // Helper function to get field label from form definition
  const getFieldLabel = (formId: string, fieldName: string, submissionForm?: any): string => {
    // First try to find in available forms (current stage)
    let form = availableForms.find((f: any) => f.id === formId);

    // If not found and submission form is provided, use that (for historical forms)
    if (!form && submissionForm) {
      form = submissionForm;
    }

    if (!form || !form.fields) return fieldName;

    const field = form.fields.find((f: any) => f.name === fieldName);
    return field?.label || fieldName;
  };

  const handleEditSubmission = (submission: any) => {
    setEditingSubmissionId(submission.id);
    setSubmissionResponses(submission.responses || {});
  };

  const handleUpdateSubmission = async (submissionId: string) => {
    try {
      await db.transact([
        db.tx.form_submissions[submissionId].update({
          responses: submissionResponses,
        }),
      ]);
      setEditingSubmissionId(null);
      showToast("Submission updated successfully!");
    } catch (error) {
      console.error("Error updating submission:", error);
      alert("Failed to update submission");
    }
  };

  const toggleHistory = (historyId: string) => {
    const newExpanded = new Set(expandedHistory);
    if (newExpanded.has(historyId)) {
      newExpanded.delete(historyId);
    } else {
      newExpanded.add(historyId);
    }
    setExpandedHistory(newExpanded);
  };

  const handleSubmitAdminForm = async (formId: string, formFields: any[]) => {
    // Validate required fields
    for (const field of formFields) {
      if (field.type !== "content" && field.required && !adminFormResponses[field.name]) {
        alert(`Please fill in the required field: ${field.label}`);
        return;
      }
    }

    setSubmittingAdminForm(true);
    try {
      const submissionId = id();
      await db.transact([
        db.tx.form_submissions[submissionId]
          .update({
            responses: adminFormResponses,
            submittedAt: Date.now(),
            submitterEmail: undefined, // Admin filled
          })
          .link({ card: card.id, form: formId }),
      ]);

      // Trigger automations for form submission
      if (cardData?.stage?.pipe?.id) {
        try {
          console.log("🤖 Triggering automation for admin form submission...", {
            cardId: card.id,
            pipeId: cardData.stage.pipe.id,
            formId,
          });

          const automationResult = await checkAndExecuteAutomations({
            triggerType: "form_submission",
            cardId: card.id,
            pipeId: cardData.stage.pipe.id,
            context: {
              formId,
            },
          });

          console.log("✅ Admin form automation executed:", automationResult);
        } catch (error) {
          console.error("❌ Error triggering automations:", error);
          // Don't fail the form submission if automation fails
        }
      }

      // Reset form
      setFillingFormId(null);
      setAdminFormResponses({});
      showToast("Form submitted successfully!");
    } catch (error) {
      console.error("Error submitting admin form:", error);
      alert("Failed to submit form");
    } finally {
      setSubmittingAdminForm(false);
    }
  };

  const handleSubmitClientForm = async (formId: string, formFields: any[]) => {
    // Validate required fields
    for (const field of formFields) {
      if (field.type !== "content" && field.required && !clientFormResponses[field.name]) {
        alert(`Please fill in the required field: ${field.label}`);
        return;
      }
    }

    try {
      const submissionId = id();
      await db.transact([
        db.tx.form_submissions[submissionId]
          .update({
            responses: clientFormResponses,
            submittedAt: Date.now(),
            submitterEmail: undefined, // Filled by user in modal
          })
          .link({ card: card.id, form: formId }),
      ]);

      // Trigger automations for form submission
      if (cardData?.stage?.pipe?.id) {
        try {
          console.log("🤖 Triggering automation for client form submission...", {
            cardId: card.id,
            pipeId: cardData.stage.pipe.id,
            formId,
          });

          const automationResult = await checkAndExecuteAutomations({
            triggerType: "form_submission",
            cardId: card.id,
            pipeId: cardData.stage.pipe.id,
            context: {
              formId,
            },
          });

          console.log("✅ Client form automation executed:", automationResult);
        } catch (error) {
          console.error("❌ Error triggering automations:", error);
          // Don't fail the form submission if automation fails
        }
      }

      // Reset form
      setEditingClientFormId(null);
      setClientFormResponses({});
      showToast("Form submitted successfully!");
    } catch (error) {
      console.error("Error submitting client form:", error);
      alert("Failed to submit form");
    }
  };

  const handleDeleteCard = async () => {
    setDeleting(true);
    try {
      // Delete all related entities first
      const cardFields = cardData?.fields || [];
      const cardEmails = cardData?.emails || [];
      const cardSubmissions = cardData?.form_submissions || [];
      const cardComments = cardData?.comments || [];
      const cardHistory = cardData?.history || [];

      const transactions = [];

      // Delete all related entities
      cardFields.forEach((field: any) => {
        transactions.push(db.tx.card_fields[field.id].delete());
      });

      cardEmails.forEach((email: any) => {
        transactions.push(db.tx.card_emails[email.id].delete());
      });

      cardSubmissions.forEach((submission: any) => {
        transactions.push(db.tx.form_submissions[submission.id].delete());
      });

      cardComments.forEach((comment: any) => {
        transactions.push(db.tx.card_comments[comment.id].delete());
      });

      cardHistory.forEach((historyItem: any) => {
        transactions.push(db.tx.card_history[historyItem.id].delete());
      });

      // Finally delete the card itself
      transactions.push(db.tx.cards[card.id].delete());

      await db.transact(transactions);

      // Close modal after successful deletion
      onClose();
    } catch (error) {
      console.error("Error deleting card:", error);
      alert("Failed to delete card. Please try again.");
      setDeleting(false);
    }
  };

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);

    if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return "a few seconds";
  };

  const renderFieldInput = (field: any, readOnly: boolean = false) => {
    switch (field.type) {
      case "number":
        return (
          <input
            type="number"
            defaultValue={field.value}
            onBlur={(e) => handleUpdateField(field.id, e.target.value, field.type)}
            readOnly={readOnly}
            className={`w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        );
      case "date":
        return (
          <input
            type="date"
            defaultValue={new Date(field.value).toISOString().split("T")[0]}
            onChange={(e) => handleUpdateField(field.id, e.target.value, field.type)}
            readOnly={readOnly}
            className={`w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        );
      default:
        return (
          <input
            type="text"
            defaultValue={field.value}
            onBlur={(e) => handleUpdateField(field.id, e.target.value, field.type)}
            readOnly={readOnly}
            className={`w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        );
    }
  };

  const renderFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "number":
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        );
      case "date":
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "email":
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case "phone":
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      case "url":
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Three Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Column 1 - Left Sidebar (35%): Title + Tabs + Tab Content */}
          <div className="w-[35%] flex flex-col border-r rounded-l-lg">
            {/* Title */}
            <div className="px-6 py-4 flex-shrink-0">
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
                  className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none w-full"
                  autoFocus
                />
              ) : (
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
                >
                  {card.title}
                </h2>
              )}
            </div>

            {/* Divider */}
            <div className="border-t mx-6 flex-shrink-0"></div>

            {/* Icon Tabs */}
            <div className="flex gap-2 px-6 py-4 flex-shrink-0">
              <button
                onClick={() => setActiveTab("details")}
                className={`p-2 rounded-lg transition-colors relative group ${
                  activeTab === "details"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title={t('details')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  {t('details')}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("emails")}
                className={`p-2 rounded-lg transition-colors relative group ${
                  activeTab === "emails"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title={t('emails')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {unreadReceivedCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full min-w-[18px] text-center">
                    {unreadReceivedCount}
                  </span>
                )}
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  {t('emails')}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("sms")}
                className={`p-2 rounded-lg transition-colors relative group ${
                  activeTab === "sms"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title="SMS"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  SMS
                </span>
              </button>

              <button
                onClick={() => setActiveTab("history")}
                className={`p-2 rounded-lg transition-colors relative group ${
                  activeTab === "history"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title={t('history')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  {t('history')}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("activities")}
                className={`p-2 rounded-lg transition-colors relative group ${
                  activeTab === "activities"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Activities"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  Activities
                </span>
              </button>

              <button
                onClick={() => setActiveTab("comments")}
                className={`p-2 rounded-lg transition-colors relative group ${
                  activeTab === "comments"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Comments"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  Comments
                </span>
              </button>
            </div>

            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {activeTab === "details" && (
                <div className="space-y-3">
                  {/* Description */}
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">
                      {t('description')}
                    </label>
                    {isEditingDescription ? (
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleUpdateDescription}
                        rows={4}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Add a description..."
                      />
                    ) : (
                      <div
                        onClick={() => setIsEditingDescription(true)}
                        className="text-xs text-gray-600 cursor-pointer hover:bg-gray-50 p-1.5 rounded min-h-[60px]"
                        dangerouslySetInnerHTML={{
                          __html: card.description
                            ? replacePlaceholders(card.description, {
                                card: {
                                  title: card.title,
                                  description: card.description,
                                  fields: fields,
                                },
                                stage: {
                                  name: currentStage?.name,
                                },
                                formSubmissions: formSubmissions,
                                globalVariables: systemSettings?.globalVariables || [],
                              })
                            : "Click to add a description...",
                        }}
                      />
                    )}
                  </div>

                  {/* Custom Fields */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-base font-semibold text-gray-900">{t('customFields')}</h3>
                      <button
                        onClick={() => setIsEditingFields(!isEditingFields)}
                        className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-300 transition-colors h-6"
                      >
                        {isEditingFields ? tCommon('save') : tCommon('edit')}
                      </button>
                      {false && (
                        <button
                          onClick={() => setShowAddField(!showAddField)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {showAddField ? tCommon('cancel') : `+ ${t('addField')}`}
                        </button>
                      )}
                    </div>

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
                            {tCommon('add')}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {fields.length > 0 ? (
                        fields.map((field: any) => (
                          <div key={field.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0">
                              {renderFieldIcon(field.type)}
                            </div>
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-0.5">
                                {field.key}
                              </label>
                              {renderFieldInput(field, !isEditingFields)}
                            </div>
                            {false && (
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="mt-2 text-red-600 hover:text-red-800 text-sm"
                              >
                                {tCommon('delete')}
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">
                          沒有自訂欄位。
                          <br />
                          No custom fields yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "emails" && (
                <div className="space-y-3">
                  {/* Send Email Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Total:</span>
                      <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded">
                        {emails.length}
                      </span>
                    </div>
                    {!showEmailCompose && (
                      <div className="flex items-center gap-2">
                        {emailTemplates.length > 0 && (
                          <button
                            onClick={() => {
                              setEmailSubject("");
                              setEmailBody("");
                              setEmailTo(extractEmailAddresses(fields.find((f: any) => f.key === '電郵')?.value || ""));
                              setShowEmailCompose(true);
                              setShowTemplateSelector(true);
                            }}
                            className="px-3 h-5 bg-sky-400 text-white text-xs rounded hover:bg-sky-500 transition-colors flex items-center gap-1.5"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                            </svg>
                            Use template
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEmailSubject(buildDefaultSubject());
                            setEmailTo(extractEmailAddresses(fields.find((f: any) => f.key === '電郵')?.value || ""));
                            setShowEmailCompose(true);
                          }}
                          className="px-3 h-5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {t('composeEmail')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Render function for compose box content */}
                  {(() => {
                    const handleCloseCompose = () => {
                      setShowEmailCompose(false);
                      setEmailTo("");
                      setEmailSubject("");
                      setEmailBody("");
                      setSelectedTemplate("");
                      setEmailFromEmail(undefined);
                      setEmailFromName(undefined);
                      setEmailCc(undefined);
                      setEmailBcc(undefined);
                      setShowCc(false);
                      setShowBcc(false);
                      setShowTemplateSelector(false);
                      setEmailStatus("idle");
                      setEmailError("");
                      setEmailComposeView('inline'); // Reset to inline view
                    };

                    const composeBoxContent = (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-semibold text-gray-900">Compose Email</h3>
                          {emailComposeView === 'inline' ? (
                            <button
                              onClick={() => setEmailComposeView('popup')}
                              className="text-gray-500 hover:text-gray-700"
                              title="Expand to popup"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => setEmailComposeView('inline')}
                              className="text-gray-500 hover:text-gray-700"
                              title="Minimize to inline"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Recipient */}
                        <div className="mb-2">
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            To
                          </label>
                          <input
                            type="text"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="recipient@example.com"
                          />
                          {/* Cc/Bcc/Template Toggle Buttons */}
                          <div className="flex gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => setShowCc(!showCc)}
                              className={`px-2 py-0.5 text-[10px] rounded ${
                                showCc
                                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                                  : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                              }`}
                            >
                              Cc
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowBcc(!showBcc)}
                              className={`px-2 py-0.5 text-[10px] rounded ${
                                showBcc
                                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                                  : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                              }`}
                            >
                              Bcc
                            </button>
                            {emailTemplates.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                                className={`px-2 py-0.5 text-[10px] rounded ${
                                  showTemplateSelector
                                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                                    : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                                }`}
                              >
                                Template
                              </button>
                            )}
                          </div>
                        </div>

                        {/* CC Field */}
                        {showCc && (
                          <div className="mb-2">
                            <label className="block text-[11px] font-medium text-gray-700 mb-1">
                              CC (Optional)
                            </label>
                            <input
                              type="text"
                              value={emailCc || ""}
                              onChange={(e) => setEmailCc(e.target.value || undefined)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                              placeholder="cc@example.com (comma-separated for multiple)"
                            />
                          </div>
                        )}

                        {/* BCC Field */}
                        {showBcc && (
                          <div className="mb-2">
                            <label className="block text-[11px] font-medium text-gray-700 mb-1">
                              BCC (Optional)
                            </label>
                            <input
                              type="text"
                              value={emailBcc || ""}
                              onChange={(e) => setEmailBcc(e.target.value || undefined)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                              placeholder="bcc@example.com (comma-separated for multiple)"
                            />
                          </div>
                        )}

                        {/* Template Selector */}
                        {showTemplateSelector && emailTemplates.length > 0 && (
                          <div className="mb-2">
                            <label className="block text-[11px] font-medium text-gray-700 mb-1">
                              Use Template (Optional)
                            </label>
                            <select
                              value={selectedTemplate}
                              onChange={(e) => handleSelectTemplate(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
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
                        <div className="mb-2">
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Subject
                          </label>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="Email subject"
                          />
                        </div>

                        {/* Body */}
                        <div className="mb-2">
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Message
                          </label>
                          <div className="max-h-[500px] overflow-y-auto">
                            <RichTextEditor
                              ref={editorRef}
                              value={emailBody}
                              onChange={setEmailBody}
                              placeholder="Email body..."
                            />
                          </div>
                        </div>

                        {/* Status Messages */}
                        {emailStatus === "success" && (
                          <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-green-800 text-xs">
                            ✅ Email sent successfully!
                          </div>
                        )}
                        {emailStatus === "error" && (
                          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                            <div className="font-semibold">❌ Failed to send email</div>
                            {emailError && (
                              <div className="text-[10px] mt-1">{emailError}</div>
                            )}
                            <div className="text-[10px] mt-1 text-red-600">
                              Check: n8n workflow is running, webhook URL is correct, and SMTP credentials are valid
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSendEmail}
                            disabled={sendingEmail || !emailTo || !emailSubject || !emailBody}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingEmail ? "Sending..." : "Send Email"}
                          </button>
                          <button
                            onClick={handleCloseCompose}
                            className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    );

                    return (
                      <>
                        {/* Inline Email Compose Box */}
                        {showEmailCompose && emailComposeView === 'inline' && (
                          <div ref={composeEmailRef} className="border border-gray-300 rounded-lg p-3 mb-4 bg-white shadow-sm">
                            {composeBoxContent}
                          </div>
                        )}

                        {/* Popup Email Compose Box */}
                        {showEmailCompose && emailComposeView === 'popup' && (
                          <div
                            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
                            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                          >
                            <div className="mx-4" style={{ width: '1000px', height: '800px' }}>
                              <div className="border border-gray-300 rounded-lg p-4 bg-white shadow-2xl h-full overflow-y-auto">
                                {composeBoxContent}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Email List */}
                  {emails.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-4xl mb-4">📭</p>
                      <div>
                        <p>尚未發送電郵</p>
                        <p className="text-sm">No emails yet</p>
                      </div>
                    </div>
                  ) : (
                    emails.map((email: any) => {
                      const isUnread = email.direction === "received" && !email.read;
                      return (
                        <div
                          key={email.id}
                          className={`border rounded-lg overflow-hidden mb-3 ${
                            expandedEmailId === email.id ? "shadow-md" : ""
                          } ${isUnread ? "border-blue-300" : "border-gray-200"}`}
                        >
                          {/* Email Header - Always Visible */}
                          <div
                            onClick={() => handleEmailClick(email)}
                            className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                                  {extractDisplayName(email.from).charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`text-sm ${isUnread ? "font-semibold" : "font-medium"} text-gray-900 truncate`}>
                                        {extractDisplayName(email.from)}
                                      </span>
                                      {isUnread && (
                                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                      {new Date(email.sentAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs text-gray-600 truncate">{email.subject}</div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {email.sentVia === "automation" && (
                                        <span className="px-2 py-0.5 text-[10px] rounded bg-gray-200 text-gray-700">
                                          Auto
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.5 text-[10px] rounded ${
                                        email.direction === "sent"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-green-100 text-green-700"
                                      }`}>
                                        {email.direction === "sent" ? t('sent') : t('received')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Email Body - Expanded */}
                          {expandedEmailId === email.id && (
                            <div className="p-3 bg-white">
                              <div className="mb-3 text-xs text-gray-600 space-y-1">
                                <div>
                                  <span className="font-medium">From:</span> {extractDisplayName(email.from)}
                                </div>
                                <div>
                                  <span className="font-medium">To:</span> {email.to}
                                </div>
                                {email.cc && (
                                  <div>
                                    <span className="font-medium">CC:</span> {email.cc}
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium">Subject:</span> {email.subject}
                                </div>
                              </div>
                              {(() => {
                                const { latestReply, previousReplies } = splitEmailBody(email.body);
                                const showPreviousReplies = expandedReplies.has(email.id);

                                return (
                                  <>
                                    <div
                                      className="prose max-w-none text-xs mb-2"
                                      dangerouslySetInnerHTML={{ __html: showPreviousReplies ? email.body : latestReply }}
                                    />
                                    {previousReplies && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedReplies(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(email.id)) {
                                              newSet.delete(email.id);
                                            } else {
                                              newSet.add(email.id);
                                            }
                                            return newSet;
                                          });
                                        }}
                                        className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center mb-3"
                                        title={showPreviousReplies ? "Hide previous replies" : "Show previous replies"}
                                      >
                                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                        </svg>
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                              <div className="flex gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedEmailId(null);
                                    setEmailTo(extractEmailAddresses(email.from));
                                    setShowEmailCompose(true);
                                    setEmailSubject(`Re: ${removeCardIdFromSubject(email.subject).replace(/^Re:\s*/i, '')}`);
                                    setEmailBody(`<p><br><br></p><hr><p><em>On ${new Date(email.sentAt).toLocaleString()}, ${email.from} wrote:</em></p>${email.body}`);
                                    setTimeout(() => {
                                      composeEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setTimeout(() => {
                                        editorRef.current?.focus();
                                      }, 100);
                                    }, 100);
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                  {t('reply')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedEmailId(null);
                                    const replyAllTo = [email.from, email.to, email.cc].filter(Boolean).join(', ');
                                    setEmailTo(extractEmailAddresses(replyAllTo));
                                    setShowEmailCompose(true);
                                    setEmailSubject(`Re: ${removeCardIdFromSubject(email.subject).replace(/^Re:\s*/i, '')}`);
                                    setEmailBody(`<p><br><br></p><hr><p><em>On ${new Date(email.sentAt).toLocaleString()}, ${email.from} wrote:</em></p>${email.body}`);
                                    setTimeout(() => {
                                      composeEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setTimeout(() => {
                                        editorRef.current?.focus();
                                      }, 100);
                                    }, 100);
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                  {t('replyAll')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedEmailId(null);
                                    setEmailTo("");
                                    setShowEmailCompose(true);
                                    setEmailSubject(`Fwd: ${removeCardIdFromSubject(email.subject)}`);
                                    setEmailBody(`<p><br><br></p><hr><p><em>Forwarded message from ${email.from}:</em></p>${email.body}`);
                                    setTimeout(() => {
                                      composeEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setTimeout(() => {
                                        editorRef.current?.focus();
                                      }, 100);
                                    }, 100);
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  {t('forward')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}


              {activeTab === "sms" && (
                <div className="space-y-4">
                  {/* Compose SMS Section */}
                  <div className="border border-gray-300 rounded-lg p-4 bg-white">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Send SMS</h3>

                    {/* Template Selector */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Use Template (Optional)
                      </label>
                      <select
                        value={selectedSmsTemplate}
                        onChange={(e) => handleSelectSmsTemplate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">-- Select a template --</option>
                        {smsTemplates.map((template: any) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Phone Number Input */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        To (Phone Number from Card)
                      </label>
                      <input
                        type="tel"
                        value={smsTo}
                        onChange={(e) => setSmsTo(e.target.value)}
                        placeholder="+852XXXXXXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Use local number (e.g., 64522883) or international format (e.g., +85264522883)</p>
                    </div>

                    {/* Message Body */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Message
                      </label>
                      <textarea
                        value={smsBody}
                        onChange={(e) => setSmsBody(e.target.value)}
                        placeholder="Type your message here..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      />
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500">{smsBody.length} / 160 characters</p>
                        {smsBody.length > 160 && (
                          <p className="text-xs text-orange-600">Message may be split into multiple SMS</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSmsTo("");
                          setSmsBody("");
                          setSelectedSmsTemplate("");
                        }}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleSendSms}
                        disabled={sendingSms || !smsTo || !smsBody}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                      >
                        {sendingSms ? "Sending..." : "Send SMS"}
                      </button>
                    </div>
                  </div>

                  {/* SMS Messages List */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">SMS History</h3>
                    {smsMessages.length === 0 ? (
                      <p className="text-gray-500 text-xs text-center py-8">No SMS messages yet</p>
                    ) : (
                      <div className="space-y-2">
                        {smsMessages.map((sms: any) => (
                          <div
                            key={sms.id}
                            className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow"
                          >
                            {/* SMS Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-[10px] rounded ${
                                  sms.direction === "sent"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}>
                                  {sms.direction === "sent" ? "Sent" : "Received"}
                                </span>
                                {sms.status && (
                                  <span className={`px-2 py-0.5 text-[10px] rounded ${
                                    sms.status === "delivered"
                                      ? "bg-green-100 text-green-700"
                                      : sms.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}>
                                    {sms.status}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-500">
                                {new Date(sms.sentAt).toLocaleString()}
                              </span>
                            </div>

                            {/* Phone Numbers */}
                            <div className="text-xs text-gray-600 mb-2">
                              <div><span className="font-medium">From:</span> {sms.from}</div>
                              <div><span className="font-medium">To:</span> {sms.to}</div>
                            </div>

                            {/* Message Body */}
                            <div className="text-sm text-gray-900 whitespace-pre-wrap">
                              {sms.body}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">{t('history')}</h3>
                  {history.length === 0 ? (
                    <p className="text-gray-500 text-xs">{t('noHistory')}</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((item: any, index: number) => {
                        const nextItem = history[index + 1];
                        const duration = nextItem ? item.timestamp - nextItem.timestamp : Date.now() - item.timestamp;

                        // Render stage move
                        if (item.type === "stage_move") {
                          return (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-2 bg-white">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                                    <svg className="w-3 h-3 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Moved to: {item.toStageName}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500">{formatDuration(duration)}</div>
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {new Date(item.timestamp).toLocaleDateString()}
                                </div>
                              </div>
                              {expandedHistory.has(item.id) && (
                                <div className="mt-1.5 pt-1.5 border-t text-xs text-gray-600">
                                  {item.fromStageName && (
                                    <div>From: {item.fromStageName}</div>
                                  )}
                                  <div>Moved: {new Date(item.timestamp).toLocaleString()}</div>
                                </div>
                              )}
                              <button
                                onClick={() => toggleHistory(item.id)}
                                className="text-[10px] text-blue-600 hover:text-blue-800 mt-1.5 flex items-center gap-1"
                              >
                                {expandedHistory.has(item.id) ? "Show less" : "Show more"}
                              </button>
                            </div>
                          );
                        }

                        // Render automation log
                        if (item.type === "automation") {
                          const isSuccess = item.status === "success";
                          const isError = item.status === "error";

                          return (
                            <div
                              key={item.id}
                              className={`border rounded-lg p-2 ${
                                isSuccess
                                  ? "bg-green-50 border-green-200"
                                  : "bg-red-50 border-red-200"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                                    {isSuccess ? (
                                      <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-3 h-3 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    )}
                                    <span>Automation: {item.automation?.name || "Unknown"}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {`${item.actionsExecuted?.length || 0} action(s) executed`}
                                  </div>
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {new Date(item.timestamp).toLocaleDateString()}
                                </div>
                              </div>
                              {expandedHistory.has(item.id) && (
                                <div className="mt-1.5 pt-1.5 border-t border-gray-300 text-xs text-gray-600 space-y-1.5">
                                  <div>
                                    <span className="font-medium">Status:</span>{" "}
                                    <span
                                      className={
                                        isSuccess
                                          ? "text-green-700 font-medium"
                                          : "text-red-700 font-medium"
                                      }
                                    >
                                      {item.status}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Trigger:</span> {item.triggerType}
                                  </div>
                                  {item.conditionsMet !== undefined && (
                                    <div>
                                      <span className="font-medium">Conditions:</span>{" "}
                                      <span
                                        className={
                                          item.conditionsMet
                                            ? "text-green-700 font-medium"
                                            : "text-red-700 font-medium"
                                        }
                                      >
                                        {item.conditionsMet ? "Met" : "Not met"}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">Executed:</span>{" "}
                                    {new Date(item.timestamp).toLocaleString()}
                                  </div>
                                  {item.errorMessage && (
                                    <div className="text-red-600">
                                      <span className="font-medium">Error:</span> {item.errorMessage}
                                    </div>
                                  )}
                                  {item.actionsExecuted && item.actionsExecuted.length > 0 && (
                                    <div>
                                      <div className="font-medium mb-1">Actions:</div>
                                      <ul className="list-disc list-inside space-y-1 pl-2">
                                        {item.actionsExecuted.map((action: any, idx: number) => (
                                          <li
                                            key={idx}
                                            className={
                                              action.status === "success"
                                                ? "text-green-700"
                                                : "text-red-700"
                                            }
                                          >
                                            {action.type}: {action.status}
                                            {action.error && (
                                              <div className="text-[10px] text-red-600 ml-4">
                                                Error: {action.error}
                                              </div>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                              <button
                                onClick={() => toggleHistory(item.id)}
                                className="text-[10px] text-blue-600 hover:text-blue-800 mt-1.5 flex items-center gap-1"
                              >
                                {expandedHistory.has(item.id) ? "Show less" : "Show more"}
                              </button>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "comments" && (
                <div className="flex flex-col h-full">
                  {/* Comments List */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {comments.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p>No comments yet</p>
                        <p className="text-sm mt-2">Be the first to add a comment</p>
                      </div>
                    ) : (
                      comments.map((comment: any) => {
                        const commentDate = new Date(comment.createdAt);
                        const now = new Date();
                        const diffMs = now.getTime() - commentDate.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMs / 3600000);
                        const diffDays = Math.floor(diffMs / 86400000);

                        let timeAgo = "";
                        if (diffMins < 1) timeAgo = "Just now";
                        else if (diffMins < 60) timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                        else if (diffHours < 24) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                        else if (diffDays < 7) timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                        else timeAgo = commentDate.toLocaleDateString();

                        return (
                          <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                                  {comment.author.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-gray-900">{comment.author}</div>
                                  <div className="text-xs text-gray-500">{timeAgo}</div>
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap ml-10">
                              {comment.body}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Comment Form */}
                  <div className="border-t pt-4 flex-shrink-0">
                    <div className="space-y-3">
                      <textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Write a comment..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                        disabled={addingComment}
                      />
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          {commentBody.length > 0 && `${commentBody.length} characters`}
                        </div>
                        <button
                          onClick={handleAddComment}
                          disabled={addingComment || !commentBody.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {addingComment ? "Adding..." : "Add Comment"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "activities" && (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p>Activities feature coming soon</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 2 - Main Content (45%): Current Phase + Forms (Always Visible) */}
          <div className="w-[45%] flex flex-col border-r">
            {/* Current Stage - Always at top */}
            <div className="px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-900 flex-shrink-0">Current Stage</h3>
                <div
                  className="px-3 py-1 rounded-lg font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-md"
                  style={{ backgroundColor: currentStage?.backgroundColor || '#DBEAFE' }}
                >
                  {currentStage?.name || "No Stage"}
                </div>
              </div>
            </div>

            {/* Inset Divider */}
            <div className="border-t mx-6 flex-shrink-0"></div>

            {/* Forms Content - Always visible, scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              <div className="space-y-6">
                {/* Admin Forms - Fill within card */}
                {adminForms.length > 0 && (
                  <div>
                    <div className="space-y-3">
                      {adminForms.map((form: any) => {
                        const alreadySubmitted = currentStageSubmissions.some((sub: any) => sub.form?.id === form.id);
                        const isFillingThis = fillingFormId === form.id;

                        return (
                          <div
                            key={form.id}
                            className="rounded-lg py-2 px-4 bg-white"
                          >
                            {isFillingThis && (
                              <div className="mt-2 space-y-3 pt-2">
                                {form.fields?.map((field: any) => {
                                  if (field.type === "content") {
                                    const processedContent = replacePlaceholders(field.content || "", {
                                      card: {
                                        title: card.title,
                                        description: card.description,
                                        fields: fields,
                                      },
                                      stage: {
                                        name: currentStage?.name,
                                      },
                                      pipe: {
                                        name: currentStage?.pipe?.name,
                                      },
                                      form: {
                                        name: form.name,
                                      },
                                      formSubmissions: formSubmissions,
                                      globalVariables: systemSettings?.globalVariables || [],
                                    });

                                    // Debug logging
                                    console.log("Content field replacement:", {
                                      original: field.content,
                                      processed: processedContent,
                                      cardTitle: card.title,
                                      stageName: currentStage?.name,
                                      pipeName: currentStage?.pipe?.name,
                                      fieldsCount: fields?.length,
                                      fields: fields?.map((f: any) => ({ key: f.key, value: f.value })),
                                      formSubmissionsCount: formSubmissions?.length,
                                    });

                                    return (
                                      <div
                                        key={field.id}
                                        className="rounded p-1 bg-white"
                                        dangerouslySetInnerHTML={{
                                          __html: processedContent,
                                        }}
                                      />
                                    );
                                  }

                                  return (
                                    <div key={field.id}>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </label>

                                      {/* Field Description */}
                                      {field.description && (
                                        <div className="text-xs text-gray-600 mb-2 flex items-start gap-2">
                                          <span className="text-blue-500 flex-shrink-0">ℹ️</span>
                                          <div dangerouslySetInnerHTML={{ __html: field.description }} />
                                        </div>
                                      )}

                                      {field.type === "textarea" ? (
                                        <textarea
                                          value={adminFormResponses[field.name] || ""}
                                          onChange={(e) => setAdminFormResponses({
                                            ...adminFormResponses,
                                            [field.name]: e.target.value,
                                          })}
                                          rows={4}
                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                      ) : field.type === "select" ? (
                                        <select
                                          value={adminFormResponses[field.name] || ""}
                                          onChange={(e) => setAdminFormResponses({
                                            ...adminFormResponses,
                                            [field.name]: e.target.value,
                                          })}
                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                          <option value="">Select...</option>
                                          {field.options?.map((opt: string) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      ) : field.type === "checkbox" ? (
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={adminFormResponses[field.name] || false}
                                            onChange={(e) => setAdminFormResponses({
                                              ...adminFormResponses,
                                              [field.name]: e.target.checked,
                                            })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                          />
                                          <span className="text-sm text-gray-600">Yes</span>
                                        </div>
                                      ) : field.type === "radio" ? (
                                        <div className="space-y-2">
                                          {field.options?.map((opt: string) => (
                                            <label key={opt} className="flex items-center gap-2">
                                              <input
                                                type="radio"
                                                name={field.name}
                                                value={opt}
                                                checked={adminFormResponses[field.name] === opt}
                                                onChange={(e) => setAdminFormResponses({
                                                  ...adminFormResponses,
                                                  [field.name]: e.target.value,
                                                })}
                                                className="w-4 h-4 text-blue-600"
                                              />
                                              <span className="text-sm text-gray-700">{opt}</span>
                                            </label>
                                          ))}
                                        </div>
                                      ) : (
                                        <input
                                          type={field.type}
                                          value={adminFormResponses[field.name] || ""}
                                          onChange={(e) => setAdminFormResponses({
                                            ...adminFormResponses,
                                            [field.name]: e.target.value,
                                          })}
                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                      )}
                                    </div>
                                  );
                                })}

                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={() => handleSubmitAdminForm(form.id, form.fields)}
                                    disabled={submittingAdminForm}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-xs flex items-center gap-1.5"
                                  >
                                    {submittingAdminForm ? (
                                      tCommon('submitting')
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        {t('submitForm')}
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFillingFormId(null);
                                      setAdminFormResponses({});
                                    }}
                                    disabled={submittingAdminForm}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs"
                                  >
                                    {tCommon('cancel')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Client Forms - Send link to client */}
                {clientForms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Client Forms (Waiting for Reply)
                    </h3>
                    <div className="space-y-3">
                      {clientForms.map((form: any) => {
                        const isExpanded = expandedClientFormId === form.id;

                        return (
                          <div
                            key={form.id}
                            className="border border-purple-200 rounded-lg p-4 bg-purple-50"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm">{form.name}</div>
                                <div className="text-xs text-gray-600">
                                  {form.fields?.length || 0} fields
                                </div>
                              </div>
                              <button
                                onClick={() => setExpandedClientFormId(isExpanded ? null : form.id)}
                                className="px-3 py-1 bg-violet-500 text-white rounded-lg hover:bg-violet-600 text-xs"
                              >
                                {isExpanded ? "Hide Fields" : "View Fields"}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="mt-4 space-y-3 border-t border-purple-200 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm text-purple-700">
                                    Preview only - Client will fill this form via link
                                  </p>
                                  <button
                                    onClick={() => {
                                      if (editingClientFormId === form.id) {
                                        setEditingClientFormId(null);
                                        setClientFormResponses({});
                                      } else {
                                        setEditingClientFormId(form.id);
                                        setClientFormResponses({});
                                      }
                                    }}
                                    className="px-3 py-1 bg-violet-500 text-white rounded text-xs hover:bg-violet-600 flex items-center gap-1"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    {editingClientFormId === form.id ? tCommon('cancel') : tCommon('edit')}
                                  </button>
                                </div>
                                {form.fields?.map((field: any) => {
                                  if (field.type === "content") {
                                    const processedContent = replacePlaceholders(field.content || "", {
                                      card: {
                                        title: card.title,
                                        description: card.description,
                                        fields: fields,
                                      },
                                      stage: {
                                        name: currentStage?.name,
                                      },
                                      pipe: {
                                        name: currentStage?.pipe?.name,
                                      },
                                      form: {
                                        name: form.name,
                                      },
                                      formSubmissions: formSubmissions,
                                      globalVariables: systemSettings?.globalVariables || [],
                                    });

                                    return (
                                      <div
                                        key={field.id}
                                        className="bg-purple-100 border border-purple-300 rounded p-3"
                                        dangerouslySetInnerHTML={{
                                          __html: processedContent,
                                        }}
                                      />
                                    );
                                  }

                                  return (
                                    <div key={field.id} className="bg-white rounded-lg p-3 border border-purple-200">
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </label>

                                      {/* Field Description */}
                                      {field.description && (
                                        <div className="text-xs text-gray-600 mb-2 flex items-start gap-2">
                                          <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <div dangerouslySetInnerHTML={{ __html: field.description }} />
                                        </div>
                                      )}

                                      {/* Editable or Read-only field based on edit mode */}
                                      {editingClientFormId === form.id ? (
                                        // Edit mode - editable fields
                                        field.type === "textarea" ? (
                                          <textarea
                                            value={clientFormResponses[field.name] || ""}
                                            onChange={(e) => setClientFormResponses({...clientFormResponses, [field.name]: e.target.value})}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                                          />
                                        ) : field.type === "select" ? (
                                          <select
                                            value={clientFormResponses[field.name] || ""}
                                            onChange={(e) => setClientFormResponses({...clientFormResponses, [field.name]: e.target.value})}
                                            className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                                          >
                                            <option value="">Select...</option>
                                            {field.options?.map((opt: string) => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        ) : field.type === "checkbox" ? (
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={clientFormResponses[field.name] || false}
                                              onChange={(e) => setClientFormResponses({...clientFormResponses, [field.name]: e.target.checked})}
                                              className="w-4 h-4 text-purple-600 rounded"
                                            />
                                          </div>
                                        ) : field.type === "radio" ? (
                                          <div className="space-y-2">
                                            {field.options?.map((opt: string) => (
                                              <label key={opt} className="flex items-center gap-2">
                                                <input
                                                  type="radio"
                                                  name={field.name}
                                                  value={opt}
                                                  checked={clientFormResponses[field.name] === opt}
                                                  onChange={(e) => setClientFormResponses({...clientFormResponses, [field.name]: e.target.value})}
                                                  className="w-4 h-4 text-purple-600"
                                                />
                                                <span className="text-xs text-gray-700">{opt}</span>
                                              </label>
                                            ))}
                                          </div>
                                        ) : field.type === "file" ? (
                                          <input
                                            type="file"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                setClientFormResponses({...clientFormResponses, [field.name]: file});
                                              }
                                            }}
                                            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm"
                                          />
                                        ) : (
                                          <input
                                            type={field.type}
                                            value={clientFormResponses[field.name] || ""}
                                            onChange={(e) => setClientFormResponses({...clientFormResponses, [field.name]: e.target.value})}
                                            className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                                          />
                                        )
                                      ) : (
                                        // Preview mode - read-only fields
                                        field.type === "textarea" ? (
                                          <textarea
                                            readOnly
                                            placeholder="Client will enter text here..."
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-xs cursor-not-allowed"
                                          />
                                        ) : field.type === "select" ? (
                                          <select
                                            disabled
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-xs cursor-not-allowed"
                                          >
                                            <option value="">Select...</option>
                                            {field.options?.map((opt: string) => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        ) : field.type === "checkbox" ? (
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              disabled
                                              className="w-4 h-4 text-purple-600 rounded cursor-not-allowed"
                                            />
                                            <span className="text-xs text-gray-500">Client will check if applicable</span>
                                          </div>
                                        ) : field.type === "radio" ? (
                                          <div className="space-y-2">
                                            {field.options?.map((opt: string) => (
                                              <label key={opt} className="flex items-center gap-2">
                                                <input
                                                  type="radio"
                                                  name={field.name}
                                                  value={opt}
                                                  checked={false}
                                                  disabled
                                                  className="w-4 h-4 text-purple-600 cursor-not-allowed"
                                                />
                                                <span className="text-xs text-gray-700">{opt}</span>
                                              </label>
                                            ))}
                                          </div>
                                        ) : field.type === "file" ? (
                                          <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-xs cursor-not-allowed">
                                            📎 Client will upload file here...
                                          </div>
                                        ) : (
                                          <input
                                            type={field.type}
                                            value=""
                                            readOnly
                                            placeholder={`Client will enter ${field.type} here...`}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-xs cursor-not-allowed"
                                          />
                                        )
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Save/Cancel buttons when in edit mode */}
                                {editingClientFormId === form.id && (
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      onClick={() => handleSubmitClientForm(form.id, form.fields)}
                                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs flex items-center gap-1.5"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                      </svg>
                                      {t('submitForm')}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingClientFormId(null);
                                        setClientFormResponses({});
                                      }}
                                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs"
                                    >
                                      {tCommon('cancel')}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Current Stage Form Submissions */}
                {false && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Current Stage Submissions</h3>
                    {/* Content intentionally disabled */}
                  </div>
                )}

                {/* Historical Form Submissions (from previous stages) */}
                {historicalSubmissions.length > 0 && (
                  <div className="border-t pt-6">
                    <button
                      onClick={() => setShowHistoricalForms(!showHistoricalForms)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900 text-sm">{t('previousSubmissions')}</h3>
                          <p className="text-xs text-gray-600">
                            {historicalSubmissions.length} submission{historicalSubmissions.length > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`text-gray-600 transition-transform ${showHistoricalForms ? "rotate-180" : ""}`}>
                        ▼
                      </span>
                    </button>

                    {showHistoricalForms && (
                      <div className="mt-4 space-y-4">
                        {historicalSubmissions.map((submission: any) => (
                          <div
                            key={submission.id}
                            className="border border-orange-200 rounded-lg p-4 bg-orange-50"
                          >
                            <div className="flex items-start justify-between mb-3 pb-3 border-b border-orange-200">
                              <div>
                                <div className="inline-flex items-center gap-2 mb-2">
                                  <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-xs rounded-full font-medium">
                                    {t('historical')}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-gray-900 text-sm">
                                  {submission.form?.name || "Form Response"}
                                </h4>
                                <p className="text-xs text-gray-600 mt-1">
                                  {new Date(submission.submittedAt).toLocaleString()}
                                </p>
                                {submission.submitterEmail && (
                                  <p className="text-xs text-gray-600">
                                    From: {submission.submitterEmail}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleEditSubmission(submission)}
                                className="px-3 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                {tCommon('edit')}
                              </button>
                            </div>

                            {editingSubmissionId === submission.id ? (
                              <div className="space-y-3">
                                {Object.entries(submissionResponses).map(([key, value]: [string, any]) => (
                                  <div key={key} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-2">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        {getFieldLabel(submission.form.id, key, submission.form)}
                                      </label>
                                      {typeof value === "object" && (value?.data || value?.url) && value?.name ? (
                                        // File upload - show info but don't allow editing
                                        <div className="w-full px-3 py-2 border border-orange-300 rounded-lg bg-white">
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                              </svg>
                                              {value.name}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              ({(value.size / 1024).toFixed(2)} KB)
                                            </span>
                                            <a
                                              href={value.url || value.data}
                                              download={value.name}
                                              target={value.url ? "_blank" : undefined}
                                              rel={value.url ? "noopener noreferrer" : undefined}
                                              className="text-xs text-blue-600 hover:underline"
                                            >
                                              {value.url ? "View" : "Download"}
                                            </a>
                                          </div>
                                          <p className="text-xs text-gray-500 mt-1">{t('fileCannotEdit')}</p>
                                        </div>
                                      ) : (
                                        <input
                                          type={
                                            submission.form?.fields?.find((f: any) => f.name === key)?.type === "date" ? "date" :
                                            submission.form?.fields?.find((f: any) => f.name === key)?.type === "time" ? "time" :
                                            submission.form?.fields?.find((f: any) => f.name === key)?.type === "number" ? "number" :
                                            submission.form?.fields?.find((f: any) => f.name === key)?.type === "email" ? "email" : "text"
                                          }
                                          value={typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                                          onChange={(e) => setSubmissionResponses({
                                            ...submissionResponses,
                                            [key]: e.target.value,
                                          })}
                                          className="w-full px-3 py-2 text-xs border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white"
                                        />
                                      )}
                                    </div>
                                  </div>
                                ))}
                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={() => handleUpdateSubmission(submission.id)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs flex items-center gap-1.5"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    {t('saveChanges')}
                                  </button>
                                  <button
                                    onClick={() => setEditingSubmissionId(null)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs"
                                  >
                                    {tCommon('cancel')}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {Object.entries(submission.responses || {}).map(([key, value]: [string, any]) => (
                                  <div key={key} className="flex items-start gap-3 p-2 bg-white rounded">
                                    <div className="flex-shrink-0">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-xs font-medium text-gray-700">
                                        {getFieldLabel(submission.form.id, key, submission.form)}
                                      </div>
                                      <div className="text-xs text-gray-900">
                                        {typeof value === "boolean" ? (
                                          value ? "Yes" : "No"
                                        ) : typeof value === "object" && (value?.data || value?.url) && value?.name ? (
                                          // File upload display (supports both base64 and URL)
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                              </svg>
                                              {value.name}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              ({(value.size / 1024).toFixed(2)} KB)
                                            </span>
                                            <a
                                              href={value.url || value.data}
                                              download={value.name}
                                              target={value.url ? "_blank" : undefined}
                                              rel={value.url ? "noopener noreferrer" : undefined}
                                              className="text-xs text-blue-600 hover:underline"
                                            >
                                              {value.url ? "View" : "Download"}
                                            </a>
                                          </div>
                                        ) : (
                                          String(value)
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 3 - Right Sidebar (20%): Card Information */}
          <div className="w-[20%] flex flex-col bg-gray-50 p-6 overflow-y-auto rounded-r-lg">
            {/* Buttons Row */}
            <div className="flex items-center justify-end gap-2 mb-4">
              {/* Kebab Menu */}
              <div className="relative" id="kebab-menu-container">
                <button
                  onClick={() => setShowKebabMenu(!showKebabMenu)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v.01M12 18v.01" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showKebabMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <button
                      onClick={() => {
                        setShowKebabMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Card
                    </button>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 rounded hover:bg-gray-200 transition-colors"
              >
                ×
              </button>
            </div>

            {/* Card Info Title */}
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Card Info</h3>

            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Created</span>
                </div>
                <div className="font-medium text-xs">
                  {new Date(card.createdAt).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(card.createdAt).toLocaleTimeString()}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Updated</span>
                </div>
                <div className="font-medium text-xs">
                  {new Date(card.updatedAt).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(card.updatedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete Card?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>"{card.title}"</strong>? This will permanently delete:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1 ml-4 list-disc">
              <li>All card fields and data</li>
              <li>All emails sent/received</li>
              <li>All form submissions</li>
              <li>All comments</li>
              <li>All history records</li>
            </ul>
            <p className="text-red-600 font-semibold text-sm mb-6">
              ⚠️ This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCard}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Card"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
