"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { StageFormBuilder } from "@/components/stage-form-builder";
import { db } from "@/lib/db";
import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/contexts/toast-context";

export default function ManageFormsPage() {
  const { showToast } = useToast();
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);

  const { data } = db.useQuery({
    pipes: {
      stages: {
        forms: {},
      },
    },
  });

  const pipes = data?.pipes || [];

  const handleDeleteForm = async (formId: string, formName: string) => {
    if (!confirm(`Are you sure you want to delete the form "${formName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await db.transact([db.tx.stage_forms[formId].delete()]);
      showToast("Form deleted successfully!");
    } catch (error) {
      console.error("Error deleting form:", error);
      alert("Failed to delete form");
    }
  };

  const getTotalForms = () => {
    return pipes.reduce((total, pipe: any) => {
      return total + (pipe.stages || []).reduce((stageTotal: number, stage: any) => {
        return stageTotal + (stage.forms?.length || 0);
      }, 0);
    }, 0);
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
                  <h1 className="text-2xl font-bold text-gray-900">Manage Forms</h1>
                </div>
                <div className="text-sm text-gray-600">
                  Total Forms: <span className="font-semibold">{getTotalForms()}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Instructions */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-purple-900 mb-2">📝 Form Management</h2>
              <p className="text-sm text-purple-800">
                View, edit, and delete all your forms. Forms are organized by pipe and stage.
              </p>
            </div>

            {/* Pipes and Forms */}
            {pipes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500 mb-4">No pipes found</p>
                <Link
                  href="/pipes"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Pipes
                </Link>
              </div>
            ) : (
              pipes.map((pipe: any) => {
                const stages = (pipe.stages || []).filter((stage: any) => stage.forms && stage.forms.length > 0);

                if (stages.length === 0) return null;

                return (
                  <div key={pipe.id} className="bg-white rounded-lg shadow mb-6">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-t-lg">
                      <h2 className="text-xl font-bold">{pipe.name}</h2>
                      <p className="text-sm opacity-90 mt-1">
                        {stages.length} stage{stages.length !== 1 ? "s" : ""} with forms
                      </p>
                    </div>

                    <div className="p-6">
                      {stages.map((stage: any) => (
                        <div key={stage.id} className="mb-6 last:mb-0">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">{stage.name}</h3>
                            <span className="text-sm text-gray-500">
                              {stage.forms.length} form{stage.forms.length !== 1 ? "s" : ""}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {stage.forms.map((form: any) => (
                              <div
                                key={form.id}
                                className="border border-purple-200 rounded-lg p-4 bg-purple-50 hover:bg-purple-100 transition-colors"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">{form.name}</h4>
                                    <div className="text-sm text-gray-600 mt-1">
                                      {form.fields?.length || 0} field{form.fields?.length !== 1 ? "s" : ""}
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500">
                                      Created: {new Date(form.createdAt).toLocaleString()}
                                    </div>

                                    {/* Field Preview */}
                                    {form.fields && form.fields.length > 0 && (
                                      <div className="mt-3 space-y-1">
                                        <div className="text-xs font-semibold text-gray-700">Fields:</div>
                                        <div className="flex flex-wrap gap-2">
                                          {form.fields.map((field: any) => (
                                            <span
                                              key={field.id}
                                              className="inline-flex items-center px-2 py-1 bg-white rounded text-xs text-gray-700 border border-purple-300"
                                            >
                                              {field.label}
                                              <span className="ml-1 text-purple-600">({field.type})</span>
                                              {field.required && <span className="ml-1 text-red-500">*</span>}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-2 ml-4">
                                    <button
                                      onClick={() => {
                                        setEditingFormId(form.id);
                                        setEditingStageId(stage.id);
                                      }}
                                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteForm(form.id, form.name)}
                                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition-colors"
                                    >
                                      🗑️ Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            {getTotalForms() === 0 && pipes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-4xl mb-4">📝</p>
                <p className="text-gray-700 mb-2">No forms created yet</p>
                <p className="text-sm text-gray-500 mb-4">
                  Create forms by clicking the 📝 button on stage headers in the Kanban board
                </p>
                <Link
                  href="/pipes"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Go to Pipes
                </Link>
              </div>
            )}
          </main>

          {/* Edit Form Modal */}
          {editingFormId && editingStageId && (
            <StageFormBuilder
              stageId={editingStageId}
              existingFormId={editingFormId}
              onClose={() => {
                setEditingFormId(null);
                setEditingStageId(null);
              }}
            />
          )}
        </div>
      </SignedIn>
    </div>
  );
}
