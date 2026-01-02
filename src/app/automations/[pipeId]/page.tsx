"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { db } from "@/lib/db";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { id } from "@instantdb/react";

export default function AutomationsPage() {
  const params = useParams();
  const pipeId = params.pipeId as string;

  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<any>(null);
  const [n8nFields, setN8nFields] = useState<Array<{ name: string; label: string }>>([]);

  // Load n8n field definitions
  useEffect(() => {
    fetch("/api/n8n-fields")
      .then((res) => res.json())
      .then((data) => {
        if (data.fields) {
          setN8nFields(
            data.fields.map((f: any) => ({
              name: f.name,
              label: f.label || f.name,
            }))
          );
        }
      })
      .catch((err) => console.error("Failed to load n8n fields:", err));
  }, []);

  // Query pipe with its automations
  const { isLoading, error, data } = db.useQuery({
    pipes: {
      $: {
        where: {
          id: pipeId,
        },
      },
      automations: {},
      stages: {
        forms: {},
      },
      email_templates: {},
    },
  });

  const pipe = data?.pipes?.[0];
  const automations = pipe?.automations?.sort((a: any, b: any) => a.name.localeCompare(b.name)) || [];
  const stages = pipe?.stages || [];

  // Get all forms with their fields
  const allForms = stages.flatMap((stage: any) => stage.forms || []);

  const handleToggleAutomation = async (automationId: string, currentEnabled: boolean) => {
    await db.transact([
      db.tx.automations[automationId].update({
        enabled: !currentEnabled,
      }),
    ]);
  };

  const handleDeleteAutomation = async (automationId: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return;
    await db.transact([db.tx.automations[automationId].delete()]);
  };

  const handleCreateAutomation = () => {
    setEditingAutomation(null);
    setShowRuleBuilder(true);
  };

  const handleEditAutomation = (automation: any) => {
    setEditingAutomation(automation);
    setShowRuleBuilder(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading automations...</p>
        </div>
      </div>
    );
  }

  if (error || !pipe) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading automations</p>
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
                  <h1 className="text-2xl font-bold text-gray-900">Automations - {pipe.name}</h1>
                </div>
                <button
                  onClick={handleCreateAutomation}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  + Create Automation
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto p-6">
            {automations.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-400 text-6xl mb-4">⚙️</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No automations yet</h2>
                <p className="text-gray-600 mb-6">
                  Create your first automation to automatically move cards, send forms, or send emails
                </p>
                <button
                  onClick={handleCreateAutomation}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  Create Your First Automation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {automations.map((automation: any) => (
                  <div
                    key={automation.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              automation.enabled
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {automation.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Trigger:</span>{" "}
                            {getTriggerDescription(automation.triggerType, automation.triggerConfig, stages)}
                          </div>
                          {automation.conditions && automation.conditions.rules.length > 0 && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Conditions:</span>{" "}
                              {automation.conditions.rules.length} condition(s) -{" "}
                              <span className="text-blue-600">{automation.conditions.logic}</span> logic
                            </div>
                          )}
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Actions:</span>{" "}
                            {automation.actions?.length || 0} action(s)
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleAutomation(automation.id, automation.enabled)}
                          className={`px-3 py-1 text-sm font-medium rounded ${
                            automation.enabled
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                              : "bg-green-100 text-green-800 hover:bg-green-200"
                          }`}
                        >
                          {automation.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleEditAutomation(automation)}
                          className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAutomation(automation.id)}
                          className="px-3 py-1 text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>

        {/* Automation Rule Builder Modal */}
        {showRuleBuilder && (
          <AutomationRuleBuilder
            pipeId={pipeId}
            pipe={pipe}
            automation={editingAutomation}
            n8nFields={n8nFields}
            allForms={allForms}
            onClose={() => {
              setShowRuleBuilder(false);
              setEditingAutomation(null);
            }}
          />
        )}
      </SignedIn>
    </div>
  );
}

// Helper function to get trigger description
function getTriggerDescription(triggerType: string, triggerConfig: any, stages: any[]): string {
  switch (triggerType) {
    case "form_submission":
      return `When form "${triggerConfig?.formName || "Unknown"}" is submitted`;
    case "card_enters_stage":
      const stage = stages.find((s: any) => s.id === triggerConfig?.stageId);
      return `When card enters stage "${stage?.name || "Unknown"}"`;
    case "card_field_value":
      return `When field "${triggerConfig?.fieldKey}" ${triggerConfig?.operator} "${triggerConfig?.value}"`;
    case "time_based":
      return `At scheduled time: ${triggerConfig?.schedule}`;
    case "manual":
      return "Manual trigger";
    default:
      return "Unknown trigger";
  }
}

// Automation Rule Builder Component
function AutomationRuleBuilder({
  pipeId,
  pipe,
  automation,
  n8nFields,
  allForms,
  onClose,
}: {
  pipeId: string;
  pipe: any;
  automation: any;
  n8nFields: Array<{ name: string; label: string }>;
  allForms: any[];
  onClose: () => void;
}) {
  const [name, setName] = useState(automation?.name || "");
  const [triggerType, setTriggerType] = useState(automation?.triggerType || "form_submission");
  const [triggerConfig, setTriggerConfig] = useState(automation?.triggerConfig || {});
  const [conditions, setConditions] = useState(automation?.conditions || { logic: "AND", rules: [] });
  const [actions, setActions] = useState(automation?.actions || []);

  const stages = pipe?.stages || [];
  const forms = stages.flatMap((s: any) => (s.forms || []).map((f: any) => ({ ...f, stageName: s.name })));
  const templates = pipe?.email_templates || [];

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a name for the automation");
      return;
    }

    const automationId = automation?.id || id();
    const now = Date.now();

    await db.transact([
      db.tx.automations[automationId]
        .update({
          name: name.trim(),
          enabled: automation?.enabled ?? true,
          triggerType,
          triggerConfig,
          conditions: conditions.rules.length > 0 ? conditions : undefined,
          actions,
          position: automation?.position || 0,
          createdAt: automation?.createdAt || now,
        })
        .link({ pipe: pipeId }),
    ]);

    onClose();
  };

  const handleAddAction = () => {
    setActions([...actions, { type: "move_card", config: {} }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_: any, i: number) => i !== index));
  };

  const handleUpdateAction = (index: number, field: string, value: any) => {
    const newActions = [...actions];
    if (field === "type") {
      newActions[index] = { type: value, config: {} };
    } else {
      newActions[index] = {
        ...newActions[index],
        config: {
          ...newActions[index].config,
          [field]: value,
        },
      };
    }
    setActions(newActions);
  };

  const handleAddCondition = () => {
    setConditions({
      ...conditions,
      rules: [
        ...conditions.rules,
        { id: id(), fieldKey: "", operator: "equals", value: "" },
      ],
    });
  };

  const handleRemoveCondition = (conditionId: string) => {
    setConditions({
      ...conditions,
      rules: conditions.rules.filter((r: any) => r.id !== conditionId),
    });
  };

  const handleUpdateCondition = (conditionId: string, field: string, value: any) => {
    setConditions({
      ...conditions,
      rules: conditions.rules.map((r: any) =>
        r.id === conditionId ? { ...r, [field]: value } : r
      ),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {automation ? "Edit Automation" : "Create Automation"}
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
              Automation Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Send welcome form when card is created"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Trigger Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Trigger</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When this happens...
                </label>
                <select
                  value={triggerType}
                  onChange={(e) => {
                    setTriggerType(e.target.value);
                    setTriggerConfig({});
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="form_submission">Form is submitted</option>
                  <option value="card_enters_stage">Card enters a stage</option>
                  <option value="card_field_value">Card field has specific value</option>
                  <option value="manual">Manual trigger</option>
                </select>
              </div>

              {/* Trigger Config */}
              {triggerType === "form_submission" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Which form?
                  </label>
                  <select
                    value={triggerConfig.formId || ""}
                    onChange={(e) => {
                      const selectedForm = forms.find((f: any) => f.id === e.target.value);
                      setTriggerConfig({
                        formId: e.target.value,
                        formName: selectedForm?.name || "",
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a form...</option>
                    {forms.map((form: any) => (
                      <option key={form.id} value={form.id}>
                        {form.name} ({form.stageName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {triggerType === "card_enters_stage" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Which stage?
                  </label>
                  <select
                    value={triggerConfig.stageId || ""}
                    onChange={(e) =>
                      setTriggerConfig({
                        stageId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a stage...</option>
                    {stages.map((stage: any) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {triggerType === "card_field_value" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Field Key
                    </label>
                    <select
                      value={triggerConfig.fieldKey || ""}
                      onChange={(e) =>
                        setTriggerConfig({ ...triggerConfig, fieldKey: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a field...</option>
                      {n8nFields.map((field) => (
                        <option key={field.name} value={field.name}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Or type manually:
                      <input
                        type="text"
                        value={triggerConfig.fieldKey || ""}
                        onChange={(e) =>
                          setTriggerConfig({ ...triggerConfig, fieldKey: e.target.value })
                        }
                        placeholder="e.g., custom_field"
                        className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs w-48"
                      />
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Operator
                      </label>
                      <select
                        value={triggerConfig.operator || "equals"}
                        onChange={(e) =>
                          setTriggerConfig({ ...triggerConfig, operator: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="contains">contains</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Value
                      </label>
                      <input
                        type="text"
                        value={triggerConfig.value || ""}
                        onChange={(e) =>
                          setTriggerConfig({ ...triggerConfig, value: e.target.value })
                        }
                        placeholder="e.g., approved"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conditions Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Conditions (Optional)</h3>
                <p className="text-sm text-gray-500">Add filters to control when actions execute</p>
              </div>
              <button
                onClick={handleAddCondition}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Condition
              </button>
            </div>

            {conditions.rules.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No conditions - automation will always run when triggered
              </p>
            ) : (
              <div className="space-y-4">
                {/* Logic Selector */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Run actions if</span>
                  <select
                    value={conditions.logic}
                    onChange={(e) => setConditions({ ...conditions, logic: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="AND">ALL</option>
                    <option value="OR">ANY</option>
                  </select>
                  <span className="text-gray-600">of the following conditions are met:</span>
                </div>

                {/* Condition Rules */}
                {conditions.rules.map((condition: any) => (
                  <div key={condition.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-gray-600">Condition</span>
                      <button
                        onClick={() => handleRemoveCondition(condition.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Field (Card or Form)
                        </label>
                        <select
                          value={condition.fieldKey}
                          onChange={(e) =>
                            handleUpdateCondition(condition.id, "fieldKey", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Select a field...</option>

                          {/* Card Fields */}
                          {n8nFields.length > 0 && (
                            <optgroup label="📋 Card Fields">
                              {n8nFields.map((field) => (
                                <option key={field.name} value={field.name}>
                                  {field.label}
                                </option>
                              ))}
                            </optgroup>
                          )}

                          {/* Form Submission Fields */}
                          {allForms.map((form: any) => {
                            const formFields = form.fields?.filter((f: any) => f.type !== "content") || [];
                            if (formFields.length === 0) return null;

                            return (
                              <optgroup key={form.id} label={`📝 Form: ${form.name}`}>
                                {formFields.map((field: any) => (
                                  <option key={`${form.id}-${field.name}`} value={`form:${form.name}.${field.name}`}>
                                    {field.label}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Or type manually:
                          <input
                            type="text"
                            value={condition.fieldKey}
                            onChange={(e) =>
                              handleUpdateCondition(condition.id, "fieldKey", e.target.value)
                            }
                            placeholder="e.g., custom_field"
                            className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs w-32"
                          />
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          💡 Form fields use format: form:FormName.fieldname
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Operator
                        </label>
                        <select
                          value={condition.operator}
                          onChange={(e) =>
                            handleUpdateCondition(condition.id, "operator", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="contains">contains</option>
                          <option value="greater_than">greater than</option>
                          <option value="less_than">less than</option>
                          <option value="is_filled">is filled</option>
                          <option value="is_empty">is empty</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Value
                        </label>
                        <input
                          type="text"
                          value={condition.value}
                          onChange={(e) =>
                            handleUpdateCondition(condition.id, "value", e.target.value)
                          }
                          placeholder={
                            condition.operator === "is_filled" || condition.operator === "is_empty"
                              ? "Not required"
                              : "e.g., approved, 1000"
                          }
                          disabled={
                            condition.operator === "is_filled" || condition.operator === "is_empty"
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Actions</h3>
              <button
                onClick={handleAddAction}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Action
              </button>
            </div>

            {actions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No actions yet. Click "Add Action" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {actions.map((action: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-gray-600">
                        Action {index + 1}
                      </span>
                      <button
                        onClick={() => handleRemoveAction(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Action Type
                        </label>
                        <select
                          value={action.type}
                          onChange={(e) => handleUpdateAction(index, "type", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="move_card">Move card to stage</option>
                          <option value="send_form_link">Send form link</option>
                          <option value="send_email">Send email template</option>
                          <option value="update_field">Update card field</option>
                        </select>
                      </div>

                      {/* Action Config */}
                      {action.type === "move_card" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Target Stage
                          </label>
                          <select
                            value={action.config.targetStageId || ""}
                            onChange={(e) =>
                              handleUpdateAction(index, "targetStageId", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Select a stage...</option>
                            {stages.map((stage: any) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {action.type === "send_form_link" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Form to Send
                            </label>
                            <select
                              value={action.config.formId || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "formId", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select a form...</option>
                              {forms.map((form: any) => (
                                <option key={form.id} value={form.id}>
                                  {form.name} ({form.stageName})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Email Template (Optional)
                            </label>
                            <select
                              value={action.config.templateId || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "templateId", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Use default template</option>
                              {templates.map((template: any) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              If no template is selected, a default email will be sent
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Recipient Field (email field key)
                            </label>
                            <select
                              value={action.config.recipientField || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "recipientField", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select a field...</option>
                              {n8nFields.map((field) => (
                                <option key={field.name} value={field.name}>
                                  {field.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Or type manually:
                              <input
                                type="text"
                                value={action.config.recipientField || ""}
                                onChange={(e) =>
                                  handleUpdateAction(index, "recipientField", e.target.value)
                                }
                                placeholder="e.g., email"
                                className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs w-48"
                              />
                            </p>
                          </div>
                        </div>
                      )}

                      {action.type === "send_email" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Email Template
                            </label>
                            <select
                              value={action.config.templateId || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "templateId", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select a template...</option>
                              {templates.map((template: any) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                            {templates.length === 0 && (
                              <p className="text-xs text-amber-600 mt-1">
                                No templates found. Create one in Email Templates page.
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Form to Include (Optional)
                            </label>
                            <select
                              value={action.config.formId || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "formId", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">No form link</option>
                              {forms.map((form: any) => (
                                <option key={form.id} value={form.id}>
                                  {form.name} ({form.stageName})
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              If selected, template can use {`{{form.link}}`} placeholder
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Recipient Field (email field key)
                            </label>
                            <select
                              value={action.config.recipientField || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "recipientField", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select a field...</option>
                              {n8nFields.map((field) => (
                                <option key={field.name} value={field.name}>
                                  {field.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Or type manually:
                              <input
                                type="text"
                                value={action.config.recipientField || ""}
                                onChange={(e) =>
                                  handleUpdateAction(index, "recipientField", e.target.value)
                                }
                                placeholder="e.g., email"
                                className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs w-48"
                              />
                            </p>
                          </div>
                        </div>
                      )}

                      {action.type === "update_field" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Field Key
                            </label>
                            <select
                              value={action.config.fieldKey || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "fieldKey", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select a field...</option>
                              {n8nFields.map((field) => (
                                <option key={field.name} value={field.name}>
                                  {field.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Or type manually:
                              <input
                                type="text"
                                value={action.config.fieldKey || ""}
                                onChange={(e) =>
                                  handleUpdateAction(index, "fieldKey", e.target.value)
                                }
                                placeholder="e.g., custom_field"
                                className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs w-48"
                              />
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              New Value
                            </label>
                            <input
                              type="text"
                              value={action.config.value || ""}
                              onChange={(e) =>
                                handleUpdateAction(index, "value", e.target.value)
                              }
                              placeholder="e.g., approved"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            {automation ? "Save Changes" : "Create Automation"}
          </button>
        </div>
      </div>
    </div>
  );
}
