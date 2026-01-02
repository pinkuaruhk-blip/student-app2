"use client";

import { db } from "@/lib/db";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CheckMoveCardAutomationsPage() {
  const searchParams = useSearchParams();
  const targetStageId = searchParams.get("stageId") || "390624f3-0e50-465c-a0e2-2e4fb3449557";
  const expectedStageId = searchParams.get("expectedStageId") || "fd79352d-8653-47e1-95dc-150565bb99f5";

  const { isLoading, error, data } = db.useQuery({
    pipes: {
      automations: {},
      stages: {},
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Checking Move Card Automations</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Checking Move Card Automations</h1>
          <p className="text-red-600">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const pipes = data?.pipes || [];

  // Find all automations with move_card actions
  const moveCardAutomations: any[] = [];
  pipes.forEach((pipe: any) => {
    (pipe.automations || []).forEach((automation: any) => {
      const moveCardActions = (automation.actions || []).filter(
        (action: any) => action.type === "move_card"
      );
      if (moveCardActions.length > 0) {
        moveCardAutomations.push({
          ...automation,
          pipeName: pipe.name,
          pipeId: pipe.id,
          moveCardActions,
        });
      }
    });
  });

  // Find automations moving to the wrong stage
  const wrongStageAutomations = moveCardAutomations.filter((auto) =>
    auto.moveCardActions.some(
      (action: any) => action.config?.targetStageId === targetStageId
    )
  );

  // Find automations moving to the expected stage
  const correctStageAutomations = moveCardAutomations.filter((auto) =>
    auto.moveCardActions.some(
      (action: any) => action.config?.targetStageId === expectedStageId
    )
  );

  // Find stage names
  const getStageNameById = (stageId: string) => {
    for (const pipe of pipes) {
      const stage = (pipe.stages || []).find((s: any) => s.id === stageId);
      if (stage) return stage.name;
    }
    return "Unknown Stage";
  };

  const wrongStageName = getStageNameById(targetStageId);
  const expectedStageName = getStageNameById(expectedStageId);

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
          <h1 className="text-2xl font-bold mb-2">Move Card Automations Analysis</h1>
          <p className="text-gray-600">
            Investigating stage ID mismatch
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Total Move Card Automations
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {moveCardAutomations.length}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-6 border-2 border-red-200">
            <h3 className="text-sm font-medium text-red-700 mb-2">
              Moving to WRONG Stage
            </h3>
            <p className="text-3xl font-bold text-red-600">
              {wrongStageAutomations.length}
            </p>
            <p className="text-xs text-red-600 mt-2 font-mono">
              {targetStageId.substring(0, 8)}...
            </p>
            <p className="text-xs text-red-600 mt-1">
              {wrongStageName}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6 border-2 border-green-200">
            <h3 className="text-sm font-medium text-green-700 mb-2">
              Moving to EXPECTED Stage
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {correctStageAutomations.length}
            </p>
            <p className="text-xs text-green-600 mt-2 font-mono">
              {expectedStageId.substring(0, 8)}...
            </p>
            <p className="text-xs text-green-600 mt-1">
              {expectedStageName}
            </p>
          </div>
        </div>

        {/* Wrong Stage Automations */}
        {wrongStageAutomations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-red-600 mb-4">
              ⚠️ Automations Moving to WRONG Stage ({wrongStageName})
            </h2>
            <div className="space-y-4">
              {wrongStageAutomations.map((auto) => (
                <div
                  key={auto.id}
                  className="bg-red-50 border-2 border-red-300 rounded-lg p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-red-900">
                        {auto.name}
                      </h3>
                      <p className="text-sm text-red-700">
                        Pipe: {auto.pipeName}
                      </p>
                      <p className="text-xs text-red-600 font-mono mt-1">
                        ID: {auto.id}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        auto.enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {auto.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-700 mb-2">
                      Move Card Actions:
                    </p>
                    {auto.moveCardActions.map((action: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white border border-red-200 rounded p-3 mb-2"
                      >
                        <p className="text-xs text-gray-500 mb-1">
                          Target Stage ID:
                        </p>
                        <p className="text-sm font-mono text-red-600">
                          {action.config?.targetStageId}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          → {getStageNameById(action.config?.targetStageId)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-700 mb-1">
                      Trigger: {auto.triggerType}
                    </p>
                    {auto.triggerConfig && (
                      <pre className="text-xs bg-white p-2 rounded border border-red-200 overflow-auto">
                        {JSON.stringify(auto.triggerConfig, null, 2)}
                      </pre>
                    )}
                  </div>

                  <Link
                    href={`/debug/automation-detail?id=${auto.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Full Details →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Correct Stage Automations */}
        {correctStageAutomations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-green-600 mb-4">
              ✅ Automations Moving to EXPECTED Stage ({expectedStageName})
            </h2>
            <div className="space-y-4">
              {correctStageAutomations.map((auto) => (
                <div
                  key={auto.id}
                  className="bg-green-50 border-2 border-green-300 rounded-lg p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-green-900">
                        {auto.name}
                      </h3>
                      <p className="text-sm text-green-700">
                        Pipe: {auto.pipeName}
                      </p>
                      <p className="text-xs text-green-600 font-mono mt-1">
                        ID: {auto.id}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        auto.enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {auto.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-green-700 mb-2">
                      Move Card Actions:
                    </p>
                    {auto.moveCardActions.map((action: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white border border-green-200 rounded p-3 mb-2"
                      >
                        <p className="text-xs text-gray-500 mb-1">
                          Target Stage ID:
                        </p>
                        <p className="text-sm font-mono text-green-600">
                          {action.config?.targetStageId}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          → {getStageNameById(action.config?.targetStageId)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-green-700 mb-1">
                      Trigger: {auto.triggerType}
                    </p>
                    {auto.triggerConfig && (
                      <pre className="text-xs bg-white p-2 rounded border border-green-200 overflow-auto">
                        {JSON.stringify(auto.triggerConfig, null, 2)}
                      </pre>
                    )}
                  </div>

                  <Link
                    href={`/debug/automation-detail?id=${auto.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Full Details →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Other Move Card Automations */}
        {moveCardAutomations.length >
          wrongStageAutomations.length + correctStageAutomations.length && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-700 mb-4">
              Other Move Card Automations
            </h2>
            <div className="space-y-4">
              {moveCardAutomations
                .filter(
                  (auto) =>
                    !wrongStageAutomations.includes(auto) &&
                    !correctStageAutomations.includes(auto)
                )
                .map((auto) => (
                  <div
                    key={auto.id}
                    className="bg-white border border-gray-200 rounded-lg p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{auto.name}</h3>
                        <p className="text-sm text-gray-600">
                          Pipe: {auto.pipeName}
                        </p>
                        <p className="text-xs text-gray-500 font-mono mt-1">
                          ID: {auto.id}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          auto.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {auto.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Move Card Actions:
                      </p>
                      {auto.moveCardActions.map((action: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-gray-50 border border-gray-200 rounded p-3 mb-2"
                        >
                          <p className="text-xs text-gray-500 mb-1">
                            Target Stage ID:
                          </p>
                          <p className="text-sm font-mono">
                            {action.config?.targetStageId}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            → {getStageNameById(action.config?.targetStageId)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <Link
                      href={`/debug/automation-detail?id=${auto.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Full Details →
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
