"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { RichTextEditor } from "@/components/rich-text-editor";
import { db } from "@/lib/db";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { id } from "@instantdb/react";

export default function EmailTemplatesPage() {
  const params = useParams();
  const pipeId = params.pipeId as string;

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  // Query pipe with its email templates
  const { isLoading, error, data } = db.useQuery({
    pipes: {
      $: {
        where: {
          id: pipeId,
        },
      },
      email_templates: {},
    },
  });

  const pipe = data?.pipes?.[0];
  const templates = pipe?.email_templates || [];

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    await db.transact([db.tx.email_templates[templateId].delete()]);
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error || !pipe) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading templates</p>
          <Link href={`/pipes/${pipeId}`} className="text-blue-600 hover:underline">
            Back to Board
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SignedOut>
        <Login />
      </SignedOut>
      <SignedIn>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center gap-4">
                  <Link href={`/pipes/${pipeId}`} className="text-gray-600 hover:text-gray-900">
                    ← Back to Board
                  </Link>
                  <h1 className="text-2xl font-bold text-gray-900">Email Templates - {pipe.name}</h1>
                </div>
                <button
                  onClick={handleCreateTemplate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  + Create Template
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto p-6">
            {templates.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-400 text-6xl mb-4">📧</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No email templates yet</h2>
                <p className="text-gray-600 mb-6">
                  Create your first email template to send professional emails with form links
                </p>
                <button
                  onClick={handleCreateTemplate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  Create Your First Template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template: any) => (
                  <div
                    key={template.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">Subject:</div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                        {template.subject}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">Preview:</div>
                      <div
                        className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 max-h-32 overflow-hidden"
                        dangerouslySetInnerHTML={{
                          __html: template.body.substring(0, 200) + (template.body.length > 200 ? "..." : ""),
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="flex-1 px-3 py-2 text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="flex-1 px-3 py-2 text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>

        {/* Template Editor Modal */}
        {showEditor && (
          <TemplateEditor
            pipeId={pipeId}
            template={editingTemplate}
            onClose={() => {
              setShowEditor(false);
              setEditingTemplate(null);
            }}
          />
        )}
      </SignedIn>
    </div>
  );
}

// Template Editor Component
function TemplateEditor({
  pipeId,
  template,
  onClose,
}: {
  pipeId: string;
  template: any;
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");
  const [fromEmail, setFromEmail] = useState(template?.fromEmail || "");
  const [fromName, setFromName] = useState(template?.fromName || "");
  const [toEmail, setToEmail] = useState(template?.toEmail || "");
  const [cc, setCc] = useState(template?.cc || "");
  const [bcc, setBcc] = useState(template?.bcc || "");
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  const placeholders = [
    { key: "{{card.title}}", description: "Card title" },
    { key: "{{card.description}}", description: "Card description" },
    { key: "{{card.field.FIELDNAME}}", description: "Card field value (replace FIELDNAME)" },
    { key: "{{form.link}}", description: "Form link URL" },
    { key: "{{form.name}}", description: "Form name" },
    { key: "{{stage.name}}", description: "Current stage name" },
    { key: "{{pipe.name}}", description: "Pipe name" },
  ];

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      alert("Please fill in all required fields (name, subject, and body)");
      return;
    }

    const templateId = template?.id || id();
    const now = Date.now();

    await db.transact([
      db.tx.email_templates[templateId]
        .update({
          name: name.trim(),
          description: description.trim() || null,
          subject: subject.trim(),
          body: body.trim(),
          fromEmail: fromEmail.trim() || null,
          fromName: fromName.trim() || null,
          toEmail: toEmail.trim() || null,
          cc: cc.trim() || null,
          bcc: bcc.trim() || null,
          createdAt: template?.createdAt || now,
        })
        .link({ pipe: pipeId }),
    ]);

    onClose();
  };

  const insertPlaceholder = (placeholder: string, target: "subject" | "body") => {
    if (target === "subject") {
      setSubject(subject + placeholder);
    } else {
      setBody(body + placeholder);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {template ? "Edit Template" : "Create Template"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Email, Form Request"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Send this when client needs to fill out contact form"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* From Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Email / Reply-to (Optional)
            </label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="e.g., noreply@example.com (leave blank for default)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Used as reply-to address. Leave blank to use system default.
            </p>
          </div>

          {/* From Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Name (Optional)
            </label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="e.g., Support Team (leave blank for default)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Display name shown with the email address. Leave blank to use system default.
            </p>
          </div>

          {/* To Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Email (Optional)
            </label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="e.g., recipient@example.com (leave blank to use card field)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Override recipient email. Leave blank to use the email field from automation config.
            </p>
          </div>

          {/* CC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CC (Optional)
            </label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="e.g., team@example.com (comma-separated for multiple)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Carbon copy recipients. Separate multiple emails with commas.
            </p>
          </div>

          {/* BCC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              BCC (Optional)
            </label>
            <input
              type="email"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="e.g., admin@example.com (leave blank for no BCC)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Blind carbon copy recipient. Leave blank to not send BCC.
            </p>
          </div>

          {/* Placeholders Help */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-blue-900">Available Placeholders</h3>
              <button
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showPlaceholders ? "Hide" : "Show"}
              </button>
            </div>
            {showPlaceholders && (
              <div className="space-y-2">
                {placeholders.map((p) => (
                  <div key={p.key} className="flex items-center justify-between text-sm">
                    <div>
                      <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{p.key}</code>
                      <span className="text-gray-600 ml-2">- {p.description}</span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-blue-700 mt-2">
                  Click on a field below to insert placeholders, or type them manually
                </p>
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Line *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Action Required: Please fill out {{form.name}}"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {placeholders.slice(0, 4).map((p) => (
                <button
                  key={p.key}
                  onClick={() => insertPlaceholder(p.key, "subject")}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  + {p.key}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Body (HTML) *
            </label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write your email content here. Use the toolbar to format text and the buttons below to insert placeholders."
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {placeholders.map((p) => (
                <button
                  key={p.key}
                  onClick={() => insertPlaceholder(p.key, "body")}
                  className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-mono"
                  title={p.description}
                >
                  + {p.key}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Subject: {subject || "(empty)"}
              </div>
              <div className="border-t pt-2">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: body || "<p>(empty)</p>" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            {template ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
