"use client";

import { db } from "@/lib/db";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function StageMappingPage() {
  const searchParams = useSearchParams();
  const automationId = searchParams.get("automationId") || "5ee2844d-173f-469e-9b07-13f1449b0977";

  // Query automation with pipe and stages
  const { isLoading, error, data } = db.useQuery({
    automations: {
      $: { where: { id: automationId } },
      pipe: {
        stages: {
          $: {
            order: {
              position: "asc",
            },
          },
        },
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Stage Mapping Verification</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Stage Mapping Verification</h1>
          <p className="text-red-600">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const automation = data?.automations?.[0];
  const pipe = automation?.pipe;
  const stages = pipe?.stages || [];

  // Extract targetStageId from automation actions
  const moveCardActions = automation?.actions?.filter((a: any) => a.type === "move_card") || [];
  const configuredStageIds = moveCardActions.map((a: any) => a.config?.targetStageId).filter(Boolean);

  if (!automation) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Stage Mapping Verification</h1>
          <p className="text-gray-500">Automation not found: {automationId}</p>
        </div>
      </div>
    );
  }

  if (!pipe) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Stage Mapping Verification</h1>
          <p className="text-gray-500">Pipe not found for automation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/debug/automation-detail?id=${automationId}`}
            className="text-blue-600 hover:underline text-sm mb-2 inline-block"
          >
            ← Back to Automation Detail
          </Link>
          <h1 className="text-2xl font-bold mb-2">Stage Mapping Verification</h1>
          <p className="text-gray-600">Pipe: {pipe.name}</p>
          {automation && <p className="text-gray-600">Automation: {automation.name}</p>}
        </div>

        {/* Automation Configuration */}
        {automation && moveCardActions.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-lg mb-3">🎯 Configured Target Stage(s)</h2>
            <div className="space-y-2">
              {moveCardActions.map((action: any, idx: number) => {
                const targetStageId = action.config?.targetStageId;
                const matchingStage = stages.find((s: any) => s.id === targetStageId);

                return (
                  <div key={idx} className="bg-white p-3 rounded border">
                    <p className="text-sm">
                      <span className="font-medium">Action #{idx + 1} - Target Stage ID:</span>{" "}
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">{targetStageId || "NOT SET"}</code>
                    </p>
                    {matchingStage ? (
                      <p className="text-sm mt-1">
                        <span className="font-medium">Maps to Stage Name:</span>{" "}
                        <span className="text-green-600 font-semibold">{matchingStage.name}</span>
                      </p>
                    ) : targetStageId ? (
                      <p className="text-sm mt-1 text-red-600">
                        ⚠️ WARNING: This stage ID does not exist in the pipe!
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Highlight the two specific stages */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-lg mb-3">🔍 Your Specific Stage IDs</h2>
          <div className="space-y-2">
            <div className="bg-white p-3 rounded border">
              <p className="text-sm">
                <span className="font-medium">Expected Stage ID:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">fd79352d-8653-47e1-95dc-150565bb99f5</code>
              </p>
              {stages.find((s: any) => s.id === "fd79352d-8653-47e1-95dc-150565bb99f5") ? (
                <p className="text-sm mt-1">
                  <span className="font-medium">Stage Name:</span>{" "}
                  <span className="text-green-600 font-semibold">
                    {stages.find((s: any) => s.id === "fd79352d-8653-47e1-95dc-150565bb99f5").name}
                  </span>
                </p>
              ) : (
                <p className="text-sm mt-1 text-red-600">❌ This stage does NOT exist in this pipe</p>
              )}
            </div>
            <div className="bg-white p-3 rounded border">
              <p className="text-sm">
                <span className="font-medium">Actual Stage ID (where cards go):</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">390624f3-0e50-465c-a0e2-2e4fb3449557</code>
              </p>
              {stages.find((s: any) => s.id === "390624f3-0e50-465c-a0e2-2e4fb3449557") ? (
                <p className="text-sm mt-1">
                  <span className="font-medium">Stage Name:</span>{" "}
                  <span className="text-orange-600 font-semibold">
                    {stages.find((s: any) => s.id === "390624f3-0e50-465c-a0e2-2e4fb3449557").name}
                  </span>
                </p>
              ) : (
                <p className="text-sm mt-1 text-red-600">❌ This stage does NOT exist in this pipe</p>
              )}
            </div>
          </div>
        </div>

        {/* All Stages Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-lg">📋 All Stages in Pipe: {pipe.name}</h2>
            <p className="text-sm text-gray-600">Total stages: {stages.length}</p>
          </div>

          {stages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No stages found in this pipe
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Stage Name (What you see in dropdown)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Stage ID (What gets saved to database)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stages.map((stage: any, index: number) => {
                    const isConfigured = configuredStageIds.includes(stage.id);
                    const isExpected = stage.id === "fd79352d-8653-47e1-95dc-150565bb99f5";
                    const isActual = stage.id === "390624f3-0e50-465c-a0e2-2e4fb3449557";

                    let rowClass = "";
                    let statusBadge = null;

                    if (isExpected) {
                      rowClass = "bg-green-50";
                      statusBadge = <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">Expected Stage</span>;
                    } else if (isActual) {
                      rowClass = "bg-orange-50";
                      statusBadge = <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded">Actual Stage (Mismatch)</span>;
                    } else if (isConfigured) {
                      rowClass = "bg-blue-50";
                      statusBadge = <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">Configured</span>;
                    }

                    return (
                      <tr key={stage.id} className={rowClass}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {stage.position ?? index}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {stage.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {stage.id}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          {statusBadge}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">🔍 How to Verify the Dropdown:</h3>
          <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
            <li>Look at the table above - it shows what stage name maps to what stage ID</li>
            <li>Go to your automation editor and open the dropdown for "Target Stage"</li>
            <li>Find the stage you want to select (e.g., the one showing as "Expected Stage" above)</li>
            <li>After selecting, check if the saved Stage ID matches what you expect in the table</li>
            <li>If there's a mismatch, the dropdown options might be in the wrong order or have wrong IDs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
