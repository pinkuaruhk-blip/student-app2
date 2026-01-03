"use client";

import { db } from "@/lib/db";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function StageDropdownPage() {
  const searchParams = useSearchParams();
  const automationId = searchParams.get("automationId") || "5ee2844d-173f-469e-9b07-13f1449b0977";

  // Query automation with pipe and stages (same query as automation editor)
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
          <h1 className="text-2xl font-bold mb-6">Dropdown Stage Mapping</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Dropdown Stage Mapping</h1>
          <p className="text-red-600">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const automation = data?.automations?.[0];
  const pipe = automation?.pipe;
  const stages = pipe?.stages || [];

  // Get the configured target stage ID
  const moveCardAction = automation?.actions?.find((a: any) => a.type === "move_card");
  const configuredStageId = moveCardAction?.config?.targetStageId;

  if (!automation || !pipe) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Dropdown Stage Mapping</h1>
          <p className="text-gray-500">Automation or pipe not found</p>
        </div>
      </div>
    );
  }

  const expectedStageId = "fd79352d-8653-47e1-95dc-150565bb99f5";
  const actualStageId = "390624f3-0e50-465c-a0e2-2e4fb3449557";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/automations/${pipe.id}`}
            className="text-blue-600 hover:underline text-sm mb-2 inline-block"
          >
            ← Back to Automation Editor
          </Link>
          <h1 className="text-2xl font-bold mb-2">Dropdown Stage Mapping Verification</h1>
          <p className="text-gray-600">Pipe: {pipe.name}</p>
          <p className="text-gray-600">Automation: {automation.name}</p>
        </div>

        {/* Current Configuration */}
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-5 mb-6">
          <h2 className="font-bold text-lg mb-3">🎯 Current Automation Configuration</h2>
          {configuredStageId ? (
            <div className="bg-white p-4 rounded border-2 border-yellow-300">
              <p className="text-sm mb-2">
                <span className="font-semibold">Currently Configured Stage ID:</span>
              </p>
              <code className="bg-gray-900 text-green-400 px-3 py-2 rounded block font-mono text-sm mb-3">
                {configuredStageId}
              </code>
              <p className="text-sm">
                <span className="font-semibold">Maps to Stage Name:</span>{" "}
                <span className="text-lg font-bold text-blue-600">
                  {stages.find((s: any) => s.id === configuredStageId)?.name || "❌ STAGE NOT FOUND!"}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-red-600 font-semibold">⚠️ No move_card action configured</p>
          )}
        </div>

        {/* Your Expected vs Actual */}
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-5 mb-6">
          <h2 className="font-bold text-lg mb-3">⚠️ The Mismatch You Reported</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded border-2 border-green-500">
              <p className="text-xs text-gray-600 mb-1">EXPECTED STAGE ID:</p>
              <code className="bg-gray-900 text-green-400 px-2 py-1 rounded text-xs block mb-2 break-all">
                {expectedStageId}
              </code>
              <p className="text-sm font-semibold">
                Stage Name:{" "}
                {stages.find((s: any) => s.id === expectedStageId) ? (
                  <span className="text-green-600 text-lg">
                    {stages.find((s: any) => s.id === expectedStageId)?.name}
                  </span>
                ) : (
                  <span className="text-red-600">NOT IN THIS PIPE</span>
                )}
              </p>
            </div>
            <div className="bg-white p-4 rounded border-2 border-orange-500">
              <p className="text-xs text-gray-600 mb-1">ACTUAL STAGE ID (where cards go):</p>
              <code className="bg-gray-900 text-orange-400 px-2 py-1 rounded text-xs block mb-2 break-all">
                {actualStageId}
              </code>
              <p className="text-sm font-semibold">
                Stage Name:{" "}
                {stages.find((s: any) => s.id === actualStageId) ? (
                  <span className="text-orange-600 text-lg">
                    {stages.find((s: any) => s.id === actualStageId)?.name}
                  </span>
                ) : (
                  <span className="text-red-600">NOT IN THIS PIPE</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* The Dropdown Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-blue-500">
          <div className="bg-blue-600 text-white p-4">
            <h2 className="font-bold text-xl">📋 DROPDOWN MENU MAPPING</h2>
            <p className="text-sm text-blue-100 mt-1">
              This shows EXACTLY what appears in the "Target Stage" dropdown and what Stage ID gets saved when you select it
            </p>
          </div>

          <div className="p-4 bg-blue-50 border-b-2 border-blue-200">
            <p className="text-sm font-semibold text-blue-900">
              Total stages in dropdown: {stages.length}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              The stages appear in this order in the dropdown menu
            </p>
          </div>

          {stages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No stages found in this pipe
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase">
                      Dropdown<br/>Order
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase">
                      What You SEE<br/>in Dropdown
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase">
                      What Stage ID<br/>Gets SAVED
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((stage: any, index: number) => {
                    const isConfigured = stage.id === configuredStageId;
                    const isExpected = stage.id === expectedStageId;
                    const isActual = stage.id === actualStageId;

                    let rowClass = "";
                    const statusBadges: React.ReactElement[] = [];

                    if (isConfigured) {
                      rowClass = "bg-yellow-100 border-l-4 border-yellow-500";
                      statusBadges.push(
                        <span key="configured" className="px-3 py-1 text-xs font-bold bg-yellow-200 text-yellow-900 rounded mr-2">
                          ⭐ CURRENTLY CONFIGURED
                        </span>
                      );
                    }
                    if (isExpected) {
                      rowClass = "bg-green-100 border-l-4 border-green-500";
                      statusBadges.push(
                        <span key="expected" className="px-3 py-1 text-xs font-bold bg-green-200 text-green-900 rounded mr-2">
                          ✅ EXPECTED
                        </span>
                      );
                    }
                    if (isActual) {
                      rowClass = "bg-orange-100 border-l-4 border-orange-500";
                      statusBadges.push(
                        <span key="actual" className="px-3 py-1 text-xs font-bold bg-orange-200 text-orange-900 rounded mr-2">
                          ⚠️ ACTUAL (MISMATCH)
                        </span>
                      );
                    }

                    return (
                      <tr key={stage.id} className={`${rowClass} hover:bg-opacity-70`}>
                        <td className="px-4 py-4 text-center">
                          <div className="text-2xl font-bold text-gray-700">
                            #{index + 1}
                          </div>
                          <div className="text-xs text-gray-500">
                            (position: {stage.position ?? index})
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xl font-bold text-gray-900">
                            {stage.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            This is the text shown in the dropdown option
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <code className="text-xs bg-gray-900 text-green-400 px-3 py-2 rounded font-mono block break-all">
                            {stage.id}
                          </code>
                          <div className="text-xs text-gray-500 mt-1">
                            This ID gets saved when you select "{stage.name}"
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            {statusBadges.length > 0 ? statusBadges : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </div>
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
        <div className="mt-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-5">
          <h3 className="font-bold text-blue-900 mb-3 text-lg">🔍 How to Use This Table:</h3>
          <ol className="text-sm text-blue-900 space-y-2 ml-5 list-decimal">
            <li className="font-semibold">
              Look at the dropdown order - this is the EXACT order stages appear in the "Target Stage" dropdown
            </li>
            <li>
              Find the stage you WANT to select (look for the <span className="bg-green-200 px-2 py-0.5 rounded">EXPECTED</span> badge)
            </li>
            <li>
              Check what Stage ID gets saved when you select that stage name
            </li>
            <li>
              Compare it with the <span className="bg-orange-200 px-2 py-0.5 rounded">ACTUAL</span> stage ID (where cards actually go)
            </li>
            <li className="font-bold text-red-700">
              If the stage NAME you select doesn't match the stage ID that gets saved, then the dropdown has wrong mappings!
            </li>
          </ol>
        </div>

        {/* Quick Action */}
        <div className="mt-6 flex gap-3">
          <Link
            href={`/automations/${pipe.id}`}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Go to Automation Editor
          </Link>
          <Link
            href={`/debug/automation-detail?id=${automationId}`}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
          >
            View Raw Automation Data
          </Link>
        </div>
      </div>
    </div>
  );
}
