"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { db } from "@/lib/db";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { id } from "@instantdb/react";
import { useTranslations } from 'next-intl';

export default function PipesPage() {
  const t = useTranslations();
  const tApp = useTranslations('app');
  const tPipes = useTranslations('pipes');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [newPipeName, setNewPipeName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [openKebabMenuId, setOpenKebabMenuId] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamePipeId, setRenamePipeId] = useState<string | null>(null);
  const [renamePipeName, setRenamePipeName] = useState("");
  const { user } = db.useAuth();

  // Query all pipes
  const { isLoading, error, data } = db.useQuery({
    pipes: {},
  });

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showAccountMenu && !target.closest('.relative')) {
        setShowAccountMenu(false);
      }
    };

    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAccountMenu]);

  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openKebabMenuId && !target.closest('.kebab-menu')) {
        setOpenKebabMenuId(null);
      }
    };

    if (openKebabMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openKebabMenuId]);

  const handleCreatePipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipeName.trim()) return;

    const pipeId = id();

    // Create pipe and default stages in a single transaction
    await db.transact([
      db.tx.pipes[pipeId].update({
        name: newPipeName.trim(),
      }),
      // Create default stages: Todo, In Progress, Done
      db.tx.stages[id()].update({
        name: "Todo",
        position: 0,
      }).link({ pipe: pipeId }),
      db.tx.stages[id()].update({
        name: "In Progress",
        position: 1,
      }).link({ pipe: pipeId }),
      db.tx.stages[id()].update({
        name: "Done",
        position: 2,
      }).link({ pipe: pipeId }),
    ]);

    setNewPipeName("");
    setShowCreateForm(false);
  };

  const handleDeletePipe = async (pipeId: string) => {
    if (!confirm("Are you sure you want to delete this pipe? This will also delete all its stages and cards.")) {
      return;
    }

    await db.transact([
      db.tx.pipes[pipeId].delete(),
    ]);
  };

  const handleDuplicatePipe = async (pipeId: string) => {
    if (!confirm(tPipes('duplicateConfirm'))) {
      return;
    }

    setIsDuplicating(true);

    try {
      const response = await fetch("/api/duplicate-pipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to duplicate pipe");
      }

      // Close the kebab menu
      setOpenKebabMenuId(null);

      // Optional: Show success message or redirect
      setTimeout(() => {
        router.push(`/pipes/${result.newPipeId}`);
      }, 500);
    } catch (error) {
      console.error("Error duplicating pipe:", error);
      alert(`${tPipes('duplicateFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleRenamePipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamePipeId || !renamePipeName.trim()) return;

    await db.transact([
      db.tx.pipes[renamePipeId].update({
        name: renamePipeName.trim(),
      }),
    ]);

    setShowRenameModal(false);
    setRenamePipeId(null);
    setRenamePipeName("");
    setOpenKebabMenuId(null);
  };

  const handleSignOut = () => {
    db.auth.signOut();
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
              <div className="flex justify-between items-center py-2">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{tApp('name')}</h1>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                    title={tCommon('accountTools')}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showAccountMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      {/* User Email */}
                      <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                        {user?.email}
                      </div>

                      {/* Settings Link */}
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {tSettings('title')}
                      </Link>

                      {/* Sign Out Button */}
                      <button
                        onClick={() => {
                          setShowAccountMenu(false);
                          handleSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors text-left"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {tCommon('signOut')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">{tPipes('title')}</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showCreateForm ? tCommon('cancel') : tPipes('createNew')}
              </button>
            </div>

            {/* Create Pipe Form */}
            {showCreateForm && (
              <div className="mb-6 bg-white rounded-lg shadow p-6">
                <form onSubmit={handleCreatePipe}>
                  <div className="mb-4">
                    <label htmlFor="pipeName" className="block text-sm font-medium text-gray-700 mb-2">
                      Pipe Name
                    </label>
                    <input
                      id="pipeName"
                      type="text"
                      value={newPipeName}
                      onChange={(e) => setNewPipeName(e.target.value)}
                      placeholder="e.g., Sales Pipeline, Support Tickets"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create
                  </button>
                </form>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading pipes...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Error loading pipes: {error.message}</p>
              </div>
            )}

            {/* Pipes Grid */}
            {!isLoading && !error && data && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.pipes && data.pipes.length > 0 ? (
                  data.pipes.map((pipe: any) => (
                    <div
                      key={pipe.id}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                    >
                      <Link href={`/pipes/${pipe.id}`} className="block p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {pipe.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Click to open board
                        </p>
                      </Link>
                      <div className="border-t border-gray-200 px-6 py-3 flex justify-end">
                        <div className="relative kebab-menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenKebabMenuId(openKebabMenuId === pipe.id ? null : pipe.id);
                            }}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title={tCommon('accountTools')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>

                          {/* Dropdown Menu */}
                          {openKebabMenuId === pipe.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={() => {
                                  setRenamePipeId(pipe.id);
                                  setRenamePipeName(pipe.name);
                                  setShowRenameModal(true);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                {tCommon('rename')}
                              </button>
                              <button
                                onClick={() => {
                                  handleDuplicatePipe(pipe.id);
                                }}
                                disabled={isDuplicating}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                  isDuplicating
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {isDuplicating ? tCommon('duplicating') : tPipes('duplicate')}
                              </button>
                              <button
                                onClick={() => {
                                  setOpenKebabMenuId(null);
                                  handleDeletePipe(pipe.id);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                {tCommon('delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <p className="text-gray-500 mb-4">No pipes yet. Create your first pipe to get started!</p>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Rename Pipe Modal */}
          {showRenameModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Rename Pipe</h2>
                <form onSubmit={handleRenamePipe}>
                  <input
                    type="text"
                    value={renamePipeName}
                    onChange={(e) => setRenamePipeName(e.target.value)}
                    placeholder="Enter pipe name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                    autoFocus
                  />
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRenameModal(false);
                        setRenamePipeId(null);
                        setRenamePipeName("");
                      }}
                      className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {tCommon('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={!renamePipeName.trim()}
                      className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {tCommon('save')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
}
