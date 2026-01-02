"use client";

import { db } from "@/lib/db";
import Link from "next/link";

export default function AutomationsListDebugPage() {
  const { isLoading, error, data } = db.useQuery({
    pipes: {
      automations: {},
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">All Automations</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">All Automations</h1>
          <p className="text-red-600">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const pipes = data?.pipes || [];
  const allAutomations = pipes.flatMap((pipe: any) =>
    (pipe.automations || []).map((automation: any) => ({
      ...automation,
      pipeName: pipe.name,
      pipeId: pipe.id,
    }))
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">All Automations</h1>
          <p className="text-gray-600">
            Total automations: {allAutomations.length}
          </p>
          <Link href="/debug/automations" className="text-blue-600 hover:underline text-sm">
            ← Back to Automation Logs
          </Link>
        </div>

        {allAutomations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No automations found</p>
            <p className="text-sm text-gray-400 mt-2">
              Create an automation in the Automations page for a pipe
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {allAutomations.map((automation: any) => {
              const statusColor = automation.enabled
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800";

              return (
                <div
                  key={automation.id}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {automation.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Pipe: {automation.pipeName}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
                    >
                      {automation.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Trigger Type</p>
                      <p className="font-mono text-sm">{automation.triggerType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Actions</p>
                      <p className="text-sm">
                        {automation.actions?.length || 0} action(s)
                      </p>
                    </div>
                  </div>

                  {automation.triggerConfig && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">Trigger Config</p>
                      <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
                        {JSON.stringify(automation.triggerConfig, null, 2)}
                      </pre>
                    </div>
                  )}

                  {automation.actions && automation.actions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">Actions</p>
                      <div className="space-y-2">
                        {automation.actions.map((action: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-gray-50 p-3 rounded text-sm"
                          >
                            <div className="font-mono mb-1">{action.type}</div>
                            <pre className="text-xs text-gray-600 overflow-auto">
                              {JSON.stringify(action.config, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {automation.conditions && automation.conditions.rules?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">
                        Conditions ({automation.conditions.logic})
                      </p>
                      <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
                        {JSON.stringify(automation.conditions, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Link
                      href={`/automations/${automation.pipeId}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit Automation
                    </Link>
                    <Link
                      href={`/pipes/${automation.pipeId}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Pipe
                    </Link>
                  </div>

                  <details className="mt-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Show raw automation data
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                      {JSON.stringify(automation, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
