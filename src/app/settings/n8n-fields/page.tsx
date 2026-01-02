"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { useState, useEffect } from "react";
import Link from "next/link";

type FieldDefinition = {
  name: string; // Field name from n8n form (technical key)
  label: string; // Display label (human-readable)
  type: string; // text, number, date, select, file
  position: number; // Display order
};

export default function N8nFieldsPage() {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Load fields from server on mount
  useEffect(() => {
    fetch("/api/n8n-fields")
      .then(res => res.json())
      .then(data => {
        if (data.fields) {
          setFields(data.fields);
        }
      })
      .catch(err => console.error("Failed to load fields:", err));
  }, []);

  const saveFields = async (newFields: FieldDefinition[]) => {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/n8n-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: newFields }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setFields(newFields);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error("Failed to save fields:", e);
      setSaveStatus("error");
    }
  };

  const handleAddField = () => {
    if (!newFieldName.trim() || !newFieldLabel.trim()) {
      alert("Please provide both field name and label!");
      return;
    }

    // Check if field already exists
    if (fields.some(f => f.name === newFieldName.trim())) {
      alert("Field with this name already exists!");
      return;
    }

    const maxPosition = fields.length > 0 ? Math.max(...fields.map(f => f.position)) : -1;

    const newFields = [
      ...fields,
      {
        name: newFieldName.trim(),
        label: newFieldLabel.trim(),
        type: newFieldType,
        position: maxPosition + 1,
      }
    ];

    saveFields(newFields);
    setNewFieldName("");
    setNewFieldLabel("");
    setNewFieldType("text");
  };

  const handleDeleteField = (fieldName: string) => {
    if (!confirm(`Delete field "${fieldName}"?`)) return;

    const newFields = fields
      .filter(f => f.name !== fieldName)
      .map((f, idx) => ({ ...f, position: idx })); // Re-index positions

    saveFields(newFields);
  };

  const handleMoveField = (fieldName: string, direction: "up" | "down") => {
    const currentIndex = fields.findIndex(f => f.name === fieldName);
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === fields.length - 1) return;

    const newFields = [...fields];
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    // Swap positions
    [newFields[currentIndex], newFields[swapIndex]] = [newFields[swapIndex], newFields[currentIndex]];

    // Update position values
    newFields[currentIndex].position = currentIndex;
    newFields[swapIndex].position = swapIndex;

    saveFields(newFields);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(fields, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'n8n-field-definitions.json';
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
          saveFields(imported);
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
                  <h1 className="text-2xl font-bold text-gray-900">n8n Field Definitions</h1>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">How Fixed Fields Work</h2>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Define your fields below with exact names (matching your n8n form)</li>
                <li>Fields will be created in the order you specify</li>
                <li>When n8n sends data, it will match field names automatically</li>
                <li>Missing fields in n8n data will show as empty in cards</li>
                <li>Extra fields in n8n data will be ignored</li>
              </ol>
              <p className="text-sm text-blue-700 mt-2">
                <strong>Example:</strong> If you define "商店名稱", "電郵", "電話" here,
                your n8n form should send data with these exact keys.
              </p>
            </div>

            {/* Save Status */}
            {saveStatus === "saved" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-800">
                ✅ Fields saved successfully! They will be used for new cards.
              </div>
            )}
            {saveStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800">
                ❌ Failed to save fields. Please try again.
              </div>
            )}

            {/* Add New Field */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Field</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field Name (key, must match n8n)
                  </label>
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="e.g., email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Label (shown on cards)
                  </label>
                  <input
                    type="text"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="e.g., Email Address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field Type
                  </label>
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="file">File</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddField}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Field
                  </button>
                </div>
              </div>
            </div>

            {/* Field List */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Defined Fields ({fields.length})
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

              {fields.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No fields defined yet. Add fields above to match your n8n form structure.
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.sort((a, b) => a.position - b.position).map((field, index) => (
                    <div
                      key={field.name}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-sm text-gray-500 font-mono w-8">
                          {index + 1}.
                        </div>
                        <div className="flex-1">
                          <div className="text-base font-medium text-gray-900">
                            {field.label || field.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            Key: <span className="font-mono">{field.name}</span> • Type: {field.type}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMoveField(field.name, "up")}
                          disabled={index === 0}
                          className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveField(field.name, "down")}
                          disabled={index === fields.length - 1}
                          className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => handleDeleteField(field.name)}
                          className="ml-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* n8n Form Structure Example */}
            {fields.length > 0 && (
              <div className="mt-6 bg-gray-100 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Your n8n Form Should Send:</h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-x-auto">
{`{
  "title": "Card Title Here",
${fields.map((f, i) => `  "${f.name}": "value${i + 1}"`).join(',\n')}
}`}
                </pre>
                <p className="text-sm text-gray-600 mt-2">
                  The webhook will create exactly these fields in this order for every card.
                </p>
              </div>
            )}
          </main>
        </div>
      </SignedIn>
    </div>
  );
}
