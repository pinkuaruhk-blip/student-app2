"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { useState, useEffect } from "react";
import Link from "next/link";

type FieldDisplay = {
  fieldName: string;
  showOnCard: boolean;
};

export default function KanbanDisplayPage() {
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [displaySettings, setDisplaySettings] = useState<FieldDisplay[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Load n8n field definitions and display settings
  useEffect(() => {
    // Load field definitions
    fetch("/api/n8n-fields")
      .then(res => res.json())
      .then(data => {
        if (data.fields) {
          const fieldNames = data.fields.map((f: any) => f.name);
          setAvailableFields(fieldNames);

          // Load display settings
          return fetch("/api/kanban-display");
        }
      })
      .then(res => res?.json())
      .then(data => {
        if (data?.settings) {
          setDisplaySettings(data.settings);
        } else {
          // Initialize with all fields shown by default
          setDisplaySettings(availableFields.map(name => ({ fieldName: name, showOnCard: true })));
        }
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, [availableFields.length]); // Re-run when fields change

  const saveSettings = async (newSettings: FieldDisplay[]) => {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/kanban-display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setDisplaySettings(newSettings);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error("Failed to save settings:", e);
      setSaveStatus("error");
    }
  };

  const handleToggleField = (fieldName: string) => {
    const newSettings = displaySettings.map(setting =>
      setting.fieldName === fieldName
        ? { ...setting, showOnCard: !setting.showOnCard }
        : setting
    );

    // If field doesn't exist in settings yet, add it
    if (!newSettings.find(s => s.fieldName === fieldName)) {
      newSettings.push({ fieldName, showOnCard: true });
    }

    saveSettings(newSettings);
  };

  const handleShowAll = () => {
    const newSettings = availableFields.map(name => ({ fieldName: name, showOnCard: true }));
    saveSettings(newSettings);
  };

  const handleHideAll = () => {
    const newSettings = availableFields.map(name => ({ fieldName: name, showOnCard: false }));
    saveSettings(newSettings);
  };

  const isFieldVisible = (fieldName: string) => {
    const setting = displaySettings.find(s => s.fieldName === fieldName);
    return setting?.showOnCard ?? true; // Default to true if not found
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
                  <h1 className="text-2xl font-bold text-gray-900">Kanban Card Display</h1>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Choose Which Fields to Display on Cards</h2>
              <p className="text-sm text-blue-800">
                Select which fields should be visible on the Kanban cards. Hidden fields can still be viewed when you open the card details.
              </p>
            </div>

            {/* Save Status */}
            {saveStatus === "saved" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-800">
                ✅ Display settings saved! Refresh your Kanban board to see changes.
              </div>
            )}
            {saveStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800">
                ❌ Failed to save settings. Please try again.
              </div>
            )}

            {availableFields.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-yellow-900 mb-3">
                  No fields defined yet. Please define your fields first.
                </p>
                <Link
                  href="/settings/n8n-fields"
                  className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Define Fields →
                </Link>
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {displaySettings.filter(s => s.showOnCard).length} of {availableFields.length} fields visible
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleShowAll}
                      className="px-3 py-1 text-sm text-green-600 border border-green-600 rounded hover:bg-green-50"
                    >
                      Show All
                    </button>
                    <button
                      onClick={handleHideAll}
                      className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                    >
                      Hide All
                    </button>
                  </div>
                </div>

                {/* Field List */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Field Visibility
                  </h2>

                  <div className="space-y-2">
                    {availableFields.map((fieldName) => (
                      <div
                        key={fieldName}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isFieldVisible(fieldName)}
                            onChange={() => handleToggleField(fieldName)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <label className="text-base font-medium text-gray-900 cursor-pointer">
                            {fieldName}
                          </label>
                        </div>
                        <div className="text-sm text-gray-500">
                          {isFieldVisible(fieldName) ? (
                            <span className="text-green-600">✓ Visible</span>
                          ) : (
                            <span className="text-gray-400">Hidden</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-6 bg-gray-100 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Preview: Card will show</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• <strong>Card Title</strong> (always visible)</li>
                    {availableFields.filter(f => isFieldVisible(f)).map(fieldName => (
                      <li key={fieldName}>• <strong>{fieldName}</strong></li>
                    ))}
                  </ul>
                  {availableFields.filter(f => !isFieldVisible(f)).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-sm text-gray-600 mb-1">Hidden fields (viewable in card details):</p>
                      <ul className="text-sm text-gray-500 space-y-1">
                        {availableFields.filter(f => !isFieldVisible(f)).map(fieldName => (
                          <li key={fieldName}>• {fieldName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </SignedIn>
    </div>
  );
}
