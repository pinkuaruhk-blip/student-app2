"use client";

import { db } from "@/lib/db";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AutomationDetailPage() {
  const searchParams = useSearchParams();
  const automationId = searchParams.get("id") || "5ee2844d-173f-469e-9b07-13f1449b0977";

  const { isLoading, error, data } = db.useQuery({
    automations: {
      $: {
        where: {
          id: automationId,
        },
      },
      pipe: {
        stages: {},
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Automation Detail</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Automation Detail</h1>
          <p className="text-red-600">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const automation = data?.automations?.[0];

  if (!automation) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Automation Detail</h1>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Automation not found</p>
            <p className="text-sm text-gray-400 mt-2">
              ID: {automationId}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = automation.enabled
    ? "bg-green-100 text-green-800"
    : "bg-gray-100 text-gray-800";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/debug/automations-list"
            className="text-blue-600 hover:underline text-sm mb-2 inline-block"
          >
            ← Back to All Automations
          </Link>
          <h1 className="text-2xl font-bold mb-2">Automation Detail</h1>
          <p className="text-gray-600 text-sm font-mono">{automation.id}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-semibold text-2xl mb-2">
                {automation.name}
              </h2>
              <p className="text-sm text-gray-500">
                Pipe: {automation.pipe?.name || "Unknown"}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
            >
              {automation.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500 font-semibold mb-1">
                Trigger Type
              </p>
              <p className="font-mono text-sm bg-gray-50 p-2 rounded">
                {automation.triggerType}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold mb-1">
                Actions Count
              </p>
              <p className="text-sm bg-gray-50 p-2 rounded">
                {automation.actions?.length || 0} action(s)
              </p>
            </div>
          </div>

          {automation.triggerConfig && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 font-semibold mb-2">
                Trigger Configuration
              </p>
              <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto border">
                {JSON.stringify(automation.triggerConfig, null, 2)}
              </pre>
            </div>
          )}

          {automation.conditions && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 font-semibold mb-2">
                Conditions ({automation.conditions.logic || "AND"})
              </p>
              <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto border">
                {JSON.stringify(automation.conditions, null, 2)}
              </pre>
            </div>
          )}

          {automation.actions && automation.actions.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 font-semibold mb-2">
                Actions ({automation.actions.length})
              </p>
              <div className="space-y-3">
                {automation.actions.map((action: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-4 rounded border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-semibold text-sm">
                        {action.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        Action #{idx + 1}
                      </span>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">
                        Configuration:
                      </p>
                      <pre className="text-xs text-gray-700 overflow-auto bg-white p-3 rounded border">
                        {JSON.stringify(action.config, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6 pt-6 border-t">
            <Link
              href={`/automations/${automation.pipe?.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Edit Automation
            </Link>
            <Link
              href={`/pipes/${automation.pipe?.id}`}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            >
              View Pipe
            </Link>
          </div>

          <details className="mt-6">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 font-semibold">
              Show Full Raw JSON Data
            </summary>
            <pre className="mt-3 text-xs bg-gray-900 text-green-400 p-4 rounded overflow-auto">
              {JSON.stringify(automation, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
