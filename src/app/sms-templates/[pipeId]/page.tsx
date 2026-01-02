"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { db } from "@/lib/db";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { id } from "@instantdb/react";

export default function SmsTemplatesPage() {
  const params = useParams();
  const pipeId = params.pipeId as string;

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  // Query pipe with its SMS templates
  const { isLoading, error, data } = db.useQuery({
    pipes: {
      $: {
        where: {
          id: pipeId,
        },
      },
      sms_templates: {},
    },
  });

  const pipe = data?.pipes?.[0];
  const templates = pipe?.sms_templates || [];

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    await db.transact([db.tx.sms_templates[templateId].delete()]);
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
                  <h1 className="text-2xl font-bold text-gray-900">SMS Templates - {pipe.name}</h1>
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
                <div className="text-gray-400 text-6xl mb-4">💬</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No SMS templates yet</h2>
                <p className="text-gray-600 mb-6">
                  Create your first SMS template to send quick text messages with placeholders
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
                      <div className="text-sm font-medium text-gray-700 mb-1">Message:</div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 whitespace-pre-wrap">
                        {template.body.length > 200
                          ? template.body.substring(0, 200) + "..."
                          : template.body}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {template.body.length} characters
                      </div>
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
  const [body, setBody] = useState(template?.body || "");
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
    if (!name.trim() || !body.trim()) {
      alert("Please fill in template name and message body");
      return;
    }

    const templateId = template?.id || id();
    const now = Date.now();

    await db.transact([
      db.tx.sms_templates[templateId]
        .update({
          name: name.trim(),
          description: description.trim() || null,
          body: body.trim(),
          createdAt: template?.createdAt || now,
        })
        .link({ pipe: pipeId }),
    ]);

    onClose();
  };

  const insertPlaceholder = (placeholder: string) => {
    setBody(body + placeholder);
  };

  const characterCount = body.length;
  const smsCount = Math.ceil(characterCount / 160) || 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {template ? "Edit SMS Template" : "Create SMS Template"}
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
              placeholder="e.g., Appointment Reminder, Follow-up Message"
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
              placeholder="e.g., Send this when appointment is confirmed"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Placeholders Helper */}
          <div>
            <button
              onClick={() => setShowPlaceholders(!showPlaceholders)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
            >
              {showPlaceholders ? "Hide" : "Show"} Available Placeholders
            </button>
            {showPlaceholders && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
                <p className="text-sm text-gray-700 mb-2 font-medium">
                  Click to insert a placeholder:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {placeholders.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => insertPlaceholder(p.key)}
                      className="text-left px-3 py-2 bg-white border border-blue-300 rounded hover:bg-blue-100 text-sm"
                    >
                      <code className="font-mono text-blue-700">{p.key}</code>
                      <span className="text-gray-600 ml-2">- {p.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Body *
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your SMS message here. Use placeholders like {{card.title}} to personalize."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-gray-600">
                {characterCount} characters
                {characterCount > 160 && (
                  <span className="text-orange-600 ml-2">
                    (Will be sent as {smsCount} SMS{smsCount > 1 ? " messages" : ""})
                  </span>
                )}
              </span>
              {characterCount > 160 && (
                <span className="text-xs text-gray-500">Standard SMS limit: 160 chars</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
          >
            {template ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
