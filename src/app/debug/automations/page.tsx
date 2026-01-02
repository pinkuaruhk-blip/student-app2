"use client";

import { db } from "@/lib/db";
import Link from "next/link";

export default function AutomationDebugPage() {
  const { isLoading, error, data } = db.useQuery({
    automation_logs: {
      $: {
        limit: 50,
        order: {
          serverCreatedAt: "desc",
        },
      },
      automation: {
        pipe: {},
      },
      card: {},
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Automation Debug Logs</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Automation Debug Logs</h1>
          <p className="text-red-600">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const logs = data?.automation_logs || [];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Automation Debug Logs</h1>
          <p className="text-gray-600">
            Recent automation executions (last 50)
          </p>
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No automation logs found</p>
            <p className="text-sm text-gray-400 mt-2">
              Trigger an automation to see logs appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log: any) => {
              const statusColor =
                log.status === "success"
                  ? "bg-green-100 text-green-800"
                  : log.status === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800";

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-lg shadow p-6 border-l-4"
                  style={{
                    borderLeftColor:
                      log.status === "success"
                        ? "#10b981"
                        : log.status === "error"
                        ? "#ef4444"
                        : "#f59e0b",
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {log.automation?.name || "Unknown Automation"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(log.executedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
                    >
                      {log.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Trigger Type</p>
                      <p className="font-mono text-sm">{log.triggerType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Card</p>
                      <Link
                        href={`/pipes/${log.automation?.pipe?.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {log.card?.title || log.card?.id || "Unknown"}
                      </Link>
                    </div>
                  </div>

                  {log.conditionsMet !== undefined && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500">Conditions Met</p>
                      <p className="text-sm">
                        {log.conditionsMet ? "✅ Yes" : "❌ No"}
                      </p>
                    </div>
                  )}

                  {log.actionsExecuted && log.actionsExecuted.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">
                        Actions Executed ({log.actionsExecuted.length})
                      </p>
                      <div className="space-y-2">
                        {log.actionsExecuted.map((action: any, idx: number) => {
                          const isMoveCard = action.type === "move_card";
                          const bgColor = isMoveCard ? "bg-blue-50 border-2 border-blue-300" : "bg-gray-50";

                          return (
                            <div
                              key={idx}
                              className={`${bgColor} p-3 rounded text-sm`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-semibold">
                                  {isMoveCard && "🎯 "}
                                  {action.type}
                                </span>
                                <span
                                  className={`text-xs ${
                                    action.status === "success"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {action.status}
                                </span>
                              </div>
                              {isMoveCard && action.config?.targetStageId && (
                                <div className="mb-2 p-2 bg-blue-100 rounded">
                                  <p className="text-xs text-blue-700 font-semibold">Target Stage ID:</p>
                                  <p className="text-xs text-blue-900 font-mono break-all">
                                    {action.config.targetStageId}
                                  </p>
                                </div>
                              )}
                              {isMoveCard && action.result && (
                                <div className="mb-2 p-2 bg-green-100 rounded">
                                  <p className="text-xs text-green-700 font-semibold">Result:</p>
                                  <p className="text-xs text-green-900">
                                    Moved from: {action.result.movedFrom || "Unknown"} → {action.result.movedTo || "Unknown"}
                                  </p>
                                </div>
                              )}
                              {action.config && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gray-500 cursor-pointer">
                                    Show full config
                                  </summary>
                                  <pre className="text-xs text-gray-600 overflow-auto mt-1 bg-white p-2 rounded">
                                    {JSON.stringify(action.config, null, 2)}
                                  </pre>
                                </details>
                              )}
                              {action.error && (
                                <p className="text-red-600 text-xs mt-1">
                                  Error: {action.error}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {log.errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-sm text-red-800 font-semibold">
                        Error Message:
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {log.errorMessage}
                      </p>
                    </div>
                  )}

                  <details className="mt-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Show raw log data
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                      {JSON.stringify(log, null, 2)}
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
