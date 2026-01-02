"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { db } from "@/lib/db";
import { useState, useEffect } from "react";
import Link from "next/link";
import { id } from "@instantdb/react";
import { useRouter } from "next/navigation";

// Predefined color palette for stage backgrounds
const COLOR_PALETTE = [
  { name: "Gray", value: "#F3F4F6" },
  { name: "Blue", value: "#DBEAFE" },
  { name: "Green", value: "#D1FAE5" },
  { name: "Yellow", value: "#FEF3C7" },
  { name: "Red", value: "#FEE2E2" },
  { name: "Purple", value: "#EDE9FE" },
  { name: "Orange", value: "#FFEDD5" },
  { name: "Teal", value: "#CCFBF1" },
  { name: "Indigo", value: "#E0E7FF" },
  { name: "Pink", value: "#FFE4E6" },
  { name: "Cyan", value: "#CFFAFE" },
  { name: "Lime", value: "#ECFCCB" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [defaultFromEmail, setDefaultFromEmail] = useState("");
  const [defaultFromName, setDefaultFromName] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null); // Track which stage shows color picker
  const [emailSettingsSaved, setEmailSettingsSaved] = useState(false);

  // Language state
  const [currentLanguage, setCurrentLanguage] = useState<string>("en");
  const [languageChanged, setLanguageChanged] = useState(false);

  // Custom fields state
  const [customFields, setCustomFields] = useState<Array<{ name: string; label: string }>>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldsSaved, setFieldsSaved] = useState(false);

  // Global variables state
  const [globalVariables, setGlobalVariables] = useState<Array<{ name: string; value: string }>>([]);
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [editingVarIndex, setEditingVarIndex] = useState<number | null>(null);
  const [variablesSaved, setVariablesSaved] = useState(false);

  const { data } = db.useQuery({
    pipes: {
      stages: {},
    },
    system_settings: {},
  });

  const pipes = data?.pipes || [];
  const selectedPipe = pipes.find((p: any) => p.id === selectedPipeId);
  const stages = selectedPipe?.stages?.sort((a: any, b: any) => a.position - b.position) || [];
  const systemSettings = data?.system_settings?.[0];

  // Load system settings on mount
  useEffect(() => {
    if (systemSettings) {
      setDefaultFromEmail(systemSettings.defaultFromEmail || "");
      setDefaultFromName(systemSettings.defaultFromName || "");

      // Load global variables from system settings
      if (systemSettings.globalVariables && Array.isArray(systemSettings.globalVariables)) {
        setGlobalVariables(systemSettings.globalVariables);
      }
    }
  }, [systemSettings]);

  // Load custom fields on mount
  useEffect(() => {
    fetch("/api/n8n-fields")
      .then((res) => res.json())
      .then((data) => {
        if (data.fields && Array.isArray(data.fields)) {
          setCustomFields(data.fields);
        }
      })
      .catch((err) => console.error("Failed to load custom fields:", err));
  }, []);

  // Load current language from cookie
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const localeCookie = cookies.find(c => c.trim().startsWith('NEXT_LOCALE='));
    if (localeCookie) {
      const locale = localeCookie.split('=')[1];
      setCurrentLanguage(locale);
    }
  }, []);

  const handleAddStage = async () => {
    if (!newStageName.trim() || !selectedPipeId) return;

    const maxPosition = stages.length > 0 ? Math.max(...stages.map((s: any) => s.position)) : -1;

    await db.transact([
      db.tx.stages[id()].update({
        name: newStageName.trim(),
        position: maxPosition + 1,
      }).link({ pipe: selectedPipeId }),
    ]);

    setNewStageName("");
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("Are you sure? This will also delete all cards in this stage.")) return;

    await db.transact([
      db.tx.stages[stageId].delete(),
    ]);
  };

  const handleMoveStage = async (stageId: string, direction: "up" | "down") => {
    const currentIndex = stages.findIndex((s: any) => s.id === stageId);
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === stages.length - 1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const otherStage = stages[newIndex];

    await db.transact([
      db.tx.stages[stageId].update({
        position: otherStage.position,
      }),
      db.tx.stages[otherStage.id].update({
        position: stages[currentIndex].position,
      }),
    ]);
  };

  const handleChangeStageColor = async (stageId: string, color: string) => {
    await db.transact([
      db.tx.stages[stageId].update({
        backgroundColor: color,
      }),
    ]);
    setShowColorPicker(null); // Close color picker after selection
  };

  const handleSaveEmailSettings = async () => {
    try {
      const settingsId = systemSettings?.id || id();

      console.log("Saving email settings:", {
        settingsId,
        defaultFromEmail: defaultFromEmail.trim(),
        defaultFromName: defaultFromName.trim(),
      });

      await db.transact([
        db.tx.system_settings[settingsId].update({
          defaultFromEmail: defaultFromEmail.trim() || undefined,
          defaultFromName: defaultFromName.trim() || undefined,
        }),
      ]);

      console.log("✅ Email settings saved successfully");
      setEmailSettingsSaved(true);
      setTimeout(() => setEmailSettingsSaved(false), 3000);
    } catch (error) {
      console.error("❌ Error saving email settings:", error);
      alert("Failed to save settings: " + (error as Error).message);
    }
  };

  // Custom fields handlers
  const handleAddOrUpdateField = async () => {
    const fieldName = newFieldName.trim();
    const fieldLabel = newFieldLabel.trim();

    if (!fieldName || !fieldLabel) {
      alert("Both field name and label are required");
      return;
    }

    // Validate field name (no spaces, lowercase, alphanumeric + underscore)
    if (!/^[a-z0-9_]+$/.test(fieldName)) {
      alert("Field name must be lowercase letters, numbers, and underscores only (no spaces)");
      return;
    }

    let updatedFields = [...customFields];

    if (editingFieldIndex !== null) {
      // Update existing field
      updatedFields[editingFieldIndex] = { name: fieldName, label: fieldLabel };
      setEditingFieldIndex(null);
    } else {
      // Check if field name already exists
      if (customFields.some((f) => f.name === fieldName)) {
        alert("A field with this name already exists");
        return;
      }
      // Add new field
      updatedFields.push({ name: fieldName, label: fieldLabel });
    }

    try {
      const response = await fetch("/api/n8n-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: updatedFields }),
      });

      if (!response.ok) {
        throw new Error("Failed to save fields");
      }

      setCustomFields(updatedFields);
      setNewFieldName("");
      setNewFieldLabel("");
      setFieldsSaved(true);
      setTimeout(() => setFieldsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save field:", error);
      alert("Failed to save field: " + (error as Error).message);
    }
  };

  const handleEditField = (index: number) => {
    const field = customFields[index];
    setNewFieldName(field.name);
    setNewFieldLabel(field.label);
    setEditingFieldIndex(index);
  };

  const handleDeleteField = async (index: number) => {
    if (!confirm("Are you sure you want to delete this field definition?")) return;

    const updatedFields = customFields.filter((_, i) => i !== index);

    try {
      const response = await fetch("/api/n8n-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: updatedFields }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete field");
      }

      setCustomFields(updatedFields);
    } catch (error) {
      console.error("Failed to delete field:", error);
      alert("Failed to delete field: " + (error as Error).message);
    }
  };

  const handleCancelEdit = () => {
    setNewFieldName("");
    setNewFieldLabel("");
    setEditingFieldIndex(null);
  };

  // Global variables handlers
  const handleAddOrUpdateVariable = async () => {
    const varName = newVarName.trim();
    const varValue = newVarValue.trim();

    if (!varName || !varValue) {
      alert("Both variable name and value are required");
      return;
    }

    // Validate variable name (no spaces, lowercase, alphanumeric + underscore)
    if (!/^[a-z0-9_]+$/.test(varName)) {
      alert("Variable name must be lowercase letters, numbers, and underscores only (no spaces)");
      return;
    }

    let updatedVariables = [...globalVariables];

    if (editingVarIndex !== null) {
      // Update existing variable
      updatedVariables[editingVarIndex] = { name: varName, value: varValue };
      setEditingVarIndex(null);
    } else {
      // Check if variable name already exists
      if (globalVariables.some((v) => v.name === varName)) {
        alert("A variable with this name already exists");
        return;
      }
      // Add new variable
      updatedVariables.push({ name: varName, value: varValue });
    }

    try {
      const settingsId = systemSettings?.id || id();

      await db.transact([
        db.tx.system_settings[settingsId].update({
          globalVariables: updatedVariables,
        }),
      ]);

      setGlobalVariables(updatedVariables);
      setNewVarName("");
      setNewVarValue("");
      setVariablesSaved(true);
      setTimeout(() => setVariablesSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save variable:", error);
      alert("Failed to save variable: " + (error as Error).message);
    }
  };

  const handleEditVariable = (index: number) => {
    const variable = globalVariables[index];
    setNewVarName(variable.name);
    setNewVarValue(variable.value);
    setEditingVarIndex(index);
  };

  const handleDeleteVariable = async (index: number) => {
    if (!confirm("Are you sure you want to delete this variable?")) return;

    const updatedVariables = globalVariables.filter((_, i) => i !== index);

    try {
      const settingsId = systemSettings?.id || id();

      await db.transact([
        db.tx.system_settings[settingsId].update({
          globalVariables: updatedVariables,
        }),
      ]);

      setGlobalVariables(updatedVariables);
    } catch (error) {
      console.error("Failed to delete variable:", error);
      alert("Failed to delete variable: " + (error as Error).message);
    }
  };

  const handleCancelVariableEdit = () => {
    setNewVarName("");
    setNewVarValue("");
    setEditingVarIndex(null);
  };

  const handleChangeLanguage = (newLocale: string) => {
    // Set cookie for locale
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`; // 1 year
    setCurrentLanguage(newLocale);
    setLanguageChanged(true);

    // Reload page to apply new language
    setTimeout(() => {
      router.refresh();
      window.location.reload();
    }, 500);
  };

  const getLanguageName = (locale: string) => {
    switch (locale) {
      case 'en': return 'English';
      case 'zh-TW': return 'Traditional Chinese (繁體中文)';
      case 'zh-CN': return 'Simplified Chinese (简体中文)';
      default: return locale;
    }
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
                  <Link href="/pipes" className="text-gray-600 hover:text-gray-900">
                    ← Back to Pipes
                  </Link>
                  <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* System Information */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 mb-6 text-white">
              <h2 className="text-xl font-semibold mb-4">🔧 System Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-sm opacity-90 mb-1">InstantDB App ID</div>
                  <code className="text-xs font-mono bg-black bg-opacity-30 px-2 py-1 rounded block overflow-x-auto">
                    {process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc"}
                  </code>
                </div>

                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-sm opacity-90 mb-1">Application URL</div>
                  <code className="text-xs font-mono bg-black bg-opacity-30 px-2 py-1 rounded block overflow-x-auto">
                    {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}
                  </code>
                </div>

                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-sm opacity-90 mb-1">Total Pipes</div>
                  <div className="text-xl font-bold">{pipes.length}</div>
                </div>

                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-sm opacity-90 mb-1">Total Stages</div>
                  <div className="text-xl font-bold">
                    {pipes.reduce((acc: number, p: any) => acc + (p.stages?.length || 0), 0)}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white border-opacity-30">
                <div className="text-sm opacity-90 mb-2">Quick Links:</div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/settings/ids"
                    className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 px-3 py-1 rounded text-sm font-semibold transition-colors"
                  >
                    🔑 View All IDs
                  </Link>
                  <a
                    href="https://instantdb.com/dash"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-sm transition-colors"
                  >
                    📊 InstantDB Dashboard
                  </a>
                  <a
                    href={`https://instantdb.com/dash?s=main&t=home&app=${process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-sm transition-colors"
                  >
                    🗄️ Schema Editor
                  </a>
                  <Link
                    href="/pipes"
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-sm transition-colors"
                  >
                    📋 View Pipes
                  </Link>
                </div>
              </div>
            </div>

            {/* Language Settings */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">🌐 Language / 語言 / 语言</h2>
              <p className="text-sm text-gray-600 mb-6">
                Choose your preferred language for the application interface.
              </p>

              <div className="space-y-4">
                {/* Current Language Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Language
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-900">
                      {getLanguageName(currentLanguage)}
                    </span>
                  </div>
                </div>

                {/* Language Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Change Language
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => handleChangeLanguage('en')}
                      disabled={currentLanguage === 'en'}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                        currentLanguage === 'en'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 cursor-not-allowed'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <div className="font-medium">English</div>
                      <div className="text-xs text-gray-500 mt-1">Default</div>
                    </button>

                    <button
                      onClick={() => handleChangeLanguage('zh-TW')}
                      disabled={currentLanguage === 'zh-TW'}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                        currentLanguage === 'zh-TW'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 cursor-not-allowed'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <div className="font-medium">繁體中文</div>
                      <div className="text-xs text-gray-500 mt-1">Traditional Chinese</div>
                    </button>

                    <button
                      onClick={() => handleChangeLanguage('zh-CN')}
                      disabled={currentLanguage === 'zh-CN'}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                        currentLanguage === 'zh-CN'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 cursor-not-allowed'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <div className="font-medium">简体中文</div>
                      <div className="text-xs text-gray-500 mt-1">Simplified Chinese</div>
                    </button>
                  </div>
                </div>

                {/* Success Message */}
                {languageChanged && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Language changed! Reloading page...
                    </p>
                  </div>
                )}

                {/* Info Box */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    💡 The page will reload automatically to apply the new language setting.
                  </p>
                </div>
              </div>
            </div>

            {/* Email Settings */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">📧 Email Settings</h2>
              <p className="text-sm text-gray-600 mb-6">
                Configure default sender information for emails sent by the system.
                These defaults will be used when email templates don't specify their own values.
              </p>

              <div className="space-y-4">
                {/* Default From Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default From Email
                  </label>
                  <input
                    type="email"
                    value={defaultFromEmail}
                    onChange={(e) => setDefaultFromEmail(e.target.value)}
                    placeholder="e.g., noreply@yourdomain.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The default email address that will appear in the "From" field
                  </p>
                </div>

                {/* Default From Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default From Name
                  </label>
                  <input
                    type="text"
                    value={defaultFromName}
                    onChange={(e) => setDefaultFromName(e.target.value)}
                    placeholder="e.g., Your Company Name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The display name that will appear with the email address (e.g., "Support Team &lt;support@example.com&gt;")
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveEmailSettings}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Save Email Settings
                  </button>
                  {emailSettingsSaved && (
                    <span className="text-green-600 text-sm font-medium">
                      ✓ Settings saved successfully!
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Field Definitions */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">📝 Custom Field Definitions</h2>
              <p className="text-sm text-gray-600 mb-6">
                Define custom fields that can be used in email templates and form pre-fill.
                Use <code className="bg-gray-100 px-1 rounded text-xs">{`{{card.field.FIELD_NAME}}`}</code> in templates.
              </p>

              {/* Fields Table */}
              {customFields.length > 0 && (
                <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Field Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Field Label
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Usage
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customFields.map((field, index) => (
                        <tr key={index} className={editingFieldIndex === index ? "bg-blue-50" : ""}>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {field.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {field.label}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {`{{card.field.${field.name}}}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-right space-x-2">
                            <button
                              onClick={() => handleEditField(index)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteField(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add/Edit Field Form */}
              <div className="border-t pt-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  {editingFieldIndex !== null ? "Edit Field" : "Add New Field"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Field Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value.toLowerCase())}
                      placeholder="e.g., customer_email"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                      disabled={editingFieldIndex !== null}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Lowercase, no spaces (use underscores)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Field Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      placeholder="e.g., Customer Email"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Human-readable display name
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleAddOrUpdateField}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {editingFieldIndex !== null ? "Update Field" : "Add Field"}
                  </button>
                  {editingFieldIndex !== null && (
                    <button
                      onClick={handleCancelEdit}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {fieldsSaved && (
                    <span className="text-green-600 text-sm font-medium">
                      ✓ Field saved successfully!
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Global Variables */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">🌐 Global Variables</h2>
              <p className="text-sm text-gray-600 mb-6">
                Define global variables that can be used across all email templates.
                Use <code className="bg-gray-100 px-1 rounded text-xs">{`{{VARIABLE_NAME}}`}</code> in email templates.
              </p>

              {/* Variables Table */}
              {globalVariables.length > 0 && (
                <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Variable Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Value
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Usage
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {globalVariables.map((variable, index) => (
                        <tr key={index} className={editingVarIndex === index ? "bg-blue-50" : ""}>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {variable.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {variable.value}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {`{{${variable.name}}}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-right space-x-2">
                            <button
                              onClick={() => handleEditVariable(index)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteVariable(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add/Edit Variable Form */}
              <div className="border-t pt-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  {editingVarIndex !== null ? "Edit Variable" : "Add New Variable"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Variable Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value.toLowerCase())}
                      placeholder="e.g., year"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                      disabled={editingVarIndex !== null}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Lowercase, no spaces (use underscores)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      placeholder="e.g., 2025-26"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The value to replace in templates
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleAddOrUpdateVariable}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {editingVarIndex !== null ? "Update Variable" : "Add Variable"}
                  </button>
                  {editingVarIndex !== null && (
                    <button
                      onClick={handleCancelVariableEdit}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {variablesSaved && (
                    <span className="text-green-600 text-sm font-medium">
                      ✓ Variable saved successfully!
                    </span>
                  )}
                </div>

                {/* Example Section */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">💡 Example Usage</h4>
                  <p className="text-sm text-blue-800 mb-2">
                    Define: <code className="bg-blue-100 px-1 rounded">year</code> = <code className="bg-blue-100 px-1 rounded">2025-26</code>
                  </p>
                  <p className="text-sm text-blue-800">
                    Use in email template: <code className="bg-blue-100 px-1 rounded">{`Dear {{name}}, Welcome to {{year}}!`}</code>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Manage Stages</h2>

              {/* Pipe Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Pipe
                </label>
                <select
                  value={selectedPipeId || ""}
                  onChange={(e) => setSelectedPipeId(e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">-- Select a pipe --</option>
                  {pipes.map((pipe: any) => (
                    <option key={pipe.id} value={pipe.id}>
                      {pipe.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stages List */}
              {selectedPipeId && (
                <div>
                  <h3 className="text-base font-medium text-gray-900 mb-4">Stages</h3>

                  {stages.length > 0 ? (
                    <div className="space-y-2 mb-6">
                      {stages.map((stage: any, index: number) => (
                        <div
                          key={stage.id}
                          className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleMoveStage(stage.id, "up")}
                                disabled={index === 0}
                                className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed text-xs"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => handleMoveStage(stage.id, "down")}
                                disabled={index === stages.length - 1}
                                className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed text-xs"
                              >
                                ▼
                              </button>
                            </div>
                            <span className="font-medium text-gray-900">{stage.name}</span>

                            {/* Color Picker */}
                            <div className="relative">
                              <button
                                onClick={() => setShowColorPicker(showColorPicker === stage.id ? null : stage.id)}
                                className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                                style={{ backgroundColor: stage.backgroundColor || "#F3F4F6" }}
                                title="Change background color"
                              />

                              {showColorPicker === stage.id && (
                                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-10">
                                  <div className="grid grid-cols-4 gap-2">
                                    {COLOR_PALETTE.map((color) => (
                                      <button
                                        key={color.value}
                                        onClick={() => handleChangeStageColor(stage.id, color.value)}
                                        className="w-10 h-10 rounded border-2 hover:border-blue-500 transition-colors"
                                        style={{ backgroundColor: color.value }}
                                        title={color.name}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteStage(stage.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 mb-6">No stages yet. Add your first stage below.</p>
                  )}

                  {/* Add Stage Form */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add New Stage
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddStage();
                          }
                        }}
                        placeholder="Stage name..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      <button
                        onClick={handleAddStage}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add Stage
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Form System Section */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Client Form System</h2>

              <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="font-semibold text-purple-900 mb-2">✨ Collect Information from Clients</h3>
                <p className="text-sm text-purple-800 mb-3">
                  Create custom forms for each stage and send them to clients via email.
                </p>
                <ul className="text-sm text-purple-800 space-y-1 mb-3">
                  <li>✅ Create forms with custom fields per stage</li>
                  <li>✅ Send unique form links via email</li>
                  <li>✅ View client submissions in card details</li>
                  <li>✅ Support for text, email, number, textarea, select, checkbox</li>
                </ul>
                <Link
                  href="/settings/forms"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Manage All Forms →
                </Link>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">How to Use:</h4>
                  <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                    <li>Click the 📝 button on any stage header to create a form</li>
                    <li>Add fields with labels, types, and validation</li>
                    <li>Open a card and ensure it has an '電郵' field with client email</li>
                    <li>Click "📝 Send Form" button to send the form link to client</li>
                    <li>View submissions by clicking "📋 Submissions" button</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Public Form URL Format:</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800 break-all">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/form/[cardId]/[formId]`
                        : "/form/[cardId]/[formId]"}
                    </code>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Email Integration:</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800">
                      POST {typeof window !== "undefined" ? window.location.origin : ""}/api/send-form-link
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Body: {`{ "cardId": "...", "formId": "...", "recipientEmail": "...", "formName": "...", "cardTitle": "..." }`}
                  </p>
                </div>
              </div>
            </div>

            {/* Email Templates Section - HIDDEN: Now using pipe-specific templates */}
            {false && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📧 Email Templates</h2>

              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 mb-3">
                  Create reusable email templates with placeholders for card data.
                </p>
                <Link
                  href="/settings/email-templates"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Manage Email Templates →
                </Link>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Available Placeholders:</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800">
                      {`{{title}} - Card title`}<br/>
                      {`{{field_name}} - Any custom field value`}
                    </code>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Email API Endpoints:</h4>
                  <div className="space-y-2">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs font-semibold text-gray-700 mb-1">Send Email:</div>
                      <code className="text-xs text-gray-800">
                        POST {typeof window !== "undefined" ? window.location.origin : ""}/api/send-email
                      </code>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs font-semibold text-gray-700 mb-1">Receive Email (n8n webhook):</div>
                      <code className="text-xs text-gray-800">
                        POST {typeof window !== "undefined" ? window.location.origin : ""}/api/receive-email
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Kanban Display Settings */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🎨 Kanban Display Settings</h2>

              <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-sm text-indigo-800 mb-3">
                  Control which custom fields appear on cards in the Kanban board.
                </p>
                <Link
                  href="/settings/kanban-display"
                  className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  Configure Display →
                </Link>
              </div>
            </div>

            {/* n8n Integration Section */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ n8n Integration</h2>

              <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-900 mb-2">✨ Recommended: n8n Forms</h3>
                <p className="text-sm text-green-800 mb-3">
                  Use n8n forms for better control and automation. Define fixed fields to ensure consistency!
                </p>
                <ul className="text-sm text-green-800 space-y-1 mb-3">
                  <li>✅ Field names used directly</li>
                  <li>✅ Built-in automation workflows</li>
                  <li>✅ Auto-route cards based on values</li>
                  <li>✅ Fixed fields - same structure every time</li>
                </ul>
                <Link
                  href="/settings/n8n-fields"
                  className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  Define Fixed Fields →
                </Link>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Webhook URL (Create Cards)</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800 break-all">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID`
                        : "/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID"}
                    </code>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">API Endpoint (Move Cards)</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-xs text-gray-800">
                      POST {typeof window !== "undefined" ? window.location.origin : ""}/api/cards/move
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Body: {`{ "cardId": "...", "stageId": "..." }`}
                  </p>
                </div>
              </div>
            </div>

            {/* Formbricks Integration Section */}
            <div className="bg-white rounded-lg shadow p-6 mt-6 opacity-60">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Formbricks <span className="text-sm text-gray-500">(Legacy)</span>
              </h2>

              <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Field Mappings Required</h3>
                <p className="text-sm text-yellow-800 mb-3">
                  Formbricks uses random field IDs. Manual mapping needed.
                </p>
                <Link
                  href="/settings/formbricks"
                  className="inline-block px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                >
                  Manage Mappings →
                </Link>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <code className="text-xs text-gray-800 break-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/api/intake/formbricks?pipeId=...&stageId=...&secret=...`
                    : "/api/intake/formbricks"}
                </code>
              </div>
            </div>
          </main>
        </div>
      </SignedIn>
    </div>
  );
}
