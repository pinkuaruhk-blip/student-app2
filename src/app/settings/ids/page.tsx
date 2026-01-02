"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { db } from "@/lib/db";
import { useState } from "react";
import Link from "next/link";

export default function IDsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data } = db.useQuery({
    pipes: {
      stages: {
        forms: {},
      },
    },
  });

  const pipes = data?.pipes || [];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
                  <Link href="/settings" className="text-gray-600 hover:text-gray-900">
                    ← Back to Settings
                  </Link>
                  <h1 className="text-2xl font-bold text-gray-900">System IDs</h1>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-blue-900 mb-2">💡 How to Use IDs</h2>
              <p className="text-sm text-blue-800">
                Click the "Copy" button next to any ID to copy it to your clipboard.
                Use these IDs for API calls, webhooks, or manual operations.
              </p>
            </div>

            {/* Pipes and Stages */}
            {pipes.map((pipe: any) => (
              <div key={pipe.id} className="bg-white rounded-lg shadow mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{pipe.name}</h2>
                      <div className="text-sm opacity-90 mt-1">Pipe ID</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(pipe.id, `pipe-${pipe.id}`)}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded text-sm transition-colors"
                    >
                      {copiedId === `pipe-${pipe.id}` ? "✓ Copied!" : "Copy ID"}
                    </button>
                  </div>
                  <code className="text-xs font-mono bg-black bg-opacity-30 px-2 py-1 rounded block mt-2 overflow-x-auto">
                    {pipe.id}
                  </code>
                </div>

                <div className="p-6">
                  {/* Stages */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Stages</h3>
                    {pipe.stages && pipe.stages.length > 0 ? (
                      <div className="space-y-3">
                        {pipe.stages
                          .sort((a: any, b: any) => a.position - b.position)
                          .map((stage: any) => (
                            <div key={stage.id} className="border border-gray-200 rounded-lg">
                              {/* Stage Header */}
                              <div className="bg-gray-50 p-4 flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{stage.name}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Position: {stage.position} | Forms: {stage.forms?.length || 0}
                                  </div>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(stage.id, `stage-${stage.id}`)}
                                  className="ml-4 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
                                >
                                  {copiedId === `stage-${stage.id}` ? "✓" : "Copy"}
                                </button>
                              </div>
                              <div className="p-4 bg-white">
                                <code className="text-xs text-gray-600 break-all">{stage.id}</code>
                              </div>

                              {/* Stage Forms */}
                              {stage.forms && stage.forms.length > 0 && (
                                <div className="border-t border-gray-200 bg-purple-50 p-4">
                                  <div className="text-sm font-medium text-purple-900 mb-2">
                                    📝 Forms for this stage:
                                  </div>
                                  <div className="space-y-2">
                                    {stage.forms.map((form: any) => (
                                      <div
                                        key={form.id}
                                        className="bg-white border border-purple-200 rounded p-3 flex items-center justify-between"
                                      >
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-gray-900">
                                            {form.name}
                                          </div>
                                          <code className="text-xs text-gray-600 break-all">
                                            {form.id}
                                          </code>
                                        </div>
                                        <button
                                          onClick={() => copyToClipboard(form.id, `form-${form.id}`)}
                                          className="ml-4 px-3 py-1 bg-purple-200 hover:bg-purple-300 text-purple-700 rounded text-sm transition-colors"
                                        >
                                          {copiedId === `form-${form.id}` ? "✓" : "Copy"}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No stages in this pipe</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {pipes.length === 0 && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500 mb-4">No pipes found</p>
                <Link
                  href="/pipes"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Pipes
                </Link>
              </div>
            )}

            {/* Usage Examples */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📖 Usage Examples</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Create Card via n8n Webhook:</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800 break-all">
                      POST {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID
                    </code>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Move Card to Stage:</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800 break-all">
                      POST {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/cards/move
                      <br />
                      Body: {`{ "cardId": "YOUR_CARD_ID", "stageId": "YOUR_STAGE_ID" }`}
                    </code>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Public Form URL:</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800 break-all">
                      {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/form/YOUR_CARD_ID/YOUR_FORM_ID
                    </code>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Send Form Link via Email:</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800 break-all">
                      POST {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/send-form-link
                      <br />
                      Body: {`{ "cardId": "YOUR_CARD_ID", "formId": "YOUR_FORM_ID", "recipientEmail": "client@example.com" }`}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </SignedIn>
    </div>
  );
}
