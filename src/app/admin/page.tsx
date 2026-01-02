"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { db } from "@/lib/db";
import Link from "next/link";
import { useState } from "react";

export default function AdminPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data } = db.useQuery({
    pipes: {
      stages: {},
    },
  });

  const pipes = data?.pipes || [];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
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
                <h1 className="text-2xl font-bold text-gray-900">Admin - IDs Reference</h1>
                <Link href="/pipes" className="text-blue-600 hover:underline">
                  Back to Pipes
                </Link>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-blue-900 mb-2">
                How to use these IDs with Formbricks
              </h2>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>Copy a Pipe ID and Stage ID from below</li>
                <li>
                  In Formbricks, add these hidden fields to your form:
                  <ul className="ml-6 mt-1 space-y-1">
                    <li>• <code className="bg-blue-100 px-1 rounded">pipeId</code> = (paste Pipe ID)</li>
                    <li>• <code className="bg-blue-100 px-1 rounded">stageId</code> = (paste Stage ID)</li>
                    <li>• <code className="bg-blue-100 px-1 rounded">secret</code> = <code className="bg-blue-100 px-1 rounded">930c1ae2eea421fc1d4e2a56fc5a07b6</code></li>
                  </ul>
                </li>
                <li>
                  Set webhook URL to: <code className="bg-blue-100 px-1 rounded break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/api/intake/formbricks</code>
                </li>
                <li>Alternative: Add <code className="bg-blue-100 px-1 rounded">?secret=930c1ae2eea421fc1d4e2a56fc5a07b6</code> to the webhook URL</li>
              </ol>
            </div>

            {pipes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No pipes found. Create a pipe first!</p>
                <Link href="/pipes" className="text-blue-600 hover:underline">
                  Go to Pipes
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {pipes.map((pipe: any) => (
                  <div key={pipe.id} className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-gray-900">{pipe.name}</h2>
                        <button
                          onClick={() => copyToClipboard(pipe.id, `pipe-${pipe.id}`)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {copiedId === `pipe-${pipe.id}` ? "✓ Copied!" : "Copy Pipe ID"}
                        </button>
                      </div>
                      <code className="text-sm bg-gray-100 px-3 py-1 rounded block overflow-x-auto">
                        {pipe.id}
                      </code>
                    </div>

                    <h3 className="font-semibold text-gray-700 mb-3">Stages:</h3>
                    {pipe.stages && pipe.stages.length > 0 ? (
                      <div className="space-y-3">
                        {pipe.stages
                          .sort((a: any, b: any) => a.position - b.position)
                          .map((stage: any) => (
                            <div key={stage.id} className="bg-gray-50 p-4 rounded">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900">
                                  {stage.name}
                                  <span className="ml-2 text-xs text-gray-500">
                                    (Position: {stage.position})
                                  </span>
                                </span>
                                <button
                                  onClick={() => copyToClipboard(stage.id, `stage-${stage.id}`)}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  {copiedId === `stage-${stage.id}` ? "✓ Copied!" : "Copy Stage ID"}
                                </button>
                              </div>
                              <code className="text-xs bg-white px-2 py-1 rounded block overflow-x-auto">
                                {stage.id}
                              </code>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No stages yet</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Example Formbricks Form Structure */}
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Example Formbricks Form Structure
              </h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
{`{
  "fields": [
    {
      "type": "hidden",
      "name": "pipeId",
      "value": "YOUR_PIPE_ID_HERE"
    },
    {
      "type": "hidden",
      "name": "stageId",
      "value": "YOUR_STAGE_ID_HERE"
    },
    {
      "type": "text",
      "name": "title",
      "label": "Title",
      "required": true
    },
    {
      "type": "textarea",
      "name": "description",
      "label": "Description"
    },
    {
      "type": "email",
      "name": "email",
      "label": "Email"
    }
  ]
}`}
              </pre>
            </div>
          </main>
        </div>
      </SignedIn>
    </div>
  );
}
