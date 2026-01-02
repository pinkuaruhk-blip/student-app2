"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { useState, useEffect } from "react";
import Link from "next/link";

type FieldMapping = {
  fieldId: string;
  fieldLabel: string;
};

export default function FormbricksSettingsPage() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [newFieldId, setNewFieldId] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Load mappings from server on mount
  useEffect(() => {
    fetch("/api/formbricks-mappings")
      .then(res => res.json())
      .then(data => {
        if (data.mappings) {
          setMappings(data.mappings);
        }
      })
      .catch(err => console.error("Failed to load mappings:", err));
  }, []);

  const saveMappings = async (newMappings: FieldMapping[]) => {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/formbricks-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: newMappings }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setMappings(newMappings);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error("Failed to save mappings:", e);
      setSaveStatus("error");
    }
  };

  const handleAddMapping = () => {
    if (!newFieldId.trim() || !newFieldLabel.trim()) return;

    const newMappings = [
      ...mappings.filter(m => m.fieldId !== newFieldId),
      { fieldId: newFieldId.trim(), fieldLabel: newFieldLabel.trim() }
    ];
    saveMappings(newMappings);
    setNewFieldId("");
    setNewFieldLabel("");
  };

  const handleDeleteMapping = (fieldId: string) => {
    if (!confirm("Delete this field mapping?")) return;
    const newMappings = mappings.filter(m => m.fieldId !== fieldId);
    saveMappings(newMappings);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(mappings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'formbricks-field-mappings.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          saveMappings(imported);
        }
      } catch (error) {
        alert("Failed to import file. Please check the format.");
      }
    };
    reader.readAsText(file);
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
                  <h1 className="text-2xl font-bold text-gray-900">Formbricks Field Mappings</h1>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">How to Map Field Names</h2>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Submit a test form in Formbricks</li>
                <li>Visit <a href="/api/logs" className="underline" target="_blank">/api/logs</a> to see the webhook payload</li>
                <li>Find the field IDs in <code className="bg-blue-100 px-1 rounded">body.data.data</code></li>
                <li>Add mappings below: Field ID → Display Name</li>
              </ol>
              <p className="text-sm text-blue-700 mt-2">
                Example: <code className="bg-blue-100 px-1 rounded">avw3gfgpdit99d8e9d1qe8yg</code> → <code className="bg-blue-100 px-1 rounded">商店名稱</code>
              </p>
            </div>

            {/* Save Status */}
            {saveStatus === "saved" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-800">
                ✅ Mappings saved successfully!
              </div>
            )}
            {saveStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800">
                ❌ Failed to save mappings. Please try again.
              </div>
            )}

            {/* Add New Mapping */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Field Mapping</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formbricks Field ID
                  </label>
                  <input
                    type="text"
                    value={newFieldId}
                    onChange={(e) => setNewFieldId(e.target.value)}
                    placeholder="e.g., avw3gfgpdit99d8e9d1qe8yg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="e.g., 商店名稱 or Store Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleAddMapping}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Mapping
              </button>
            </div>

            {/* Existing Mappings */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Field Mappings ({mappings.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    className="px-3 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                  >
                    Export
                  </button>
                  <label className="px-3 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 cursor-pointer">
                    Import
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {mappings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No field mappings yet. Add one above to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {mappings.map((mapping) => (
                    <div
                      key={mapping.fieldId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-mono text-gray-600">
                          {mapping.fieldId}
                        </div>
                        <div className="text-base font-medium text-gray-900">
                          → {mapping.fieldLabel}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMapping(mapping.fieldId)}
                        className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* API Endpoint Info */}
            <div className="mt-6 bg-gray-100 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">✅ Auto-sync Enabled</h3>
              <p className="text-sm text-gray-700">
                Field mappings are automatically saved to the server and will be used by the Formbricks webhook
                when creating new cards. Changes take effect immediately.
              </p>
            </div>
          </main>
        </div>
      </SignedIn>
    </div>
  );
}
