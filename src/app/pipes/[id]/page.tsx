"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { CardModalNew } from "@/components/card-modal-new";
import { StageFormBuilder } from "@/components/stage-form-builder";
import { RichTextEditor, RichTextEditorRef } from "@/components/rich-text-editor";
import { db } from "@/lib/db";
import { checkAndExecuteAutomations } from "@/lib/automation-engine-client";
import { replacePlaceholders } from "@/lib/placeholders";
import { useToast } from "@/contexts/toast-context";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { id } from "@instantdb/react";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useTranslations } from 'next-intl';

type Card = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  stage: { id: string };
  fields?: Array<{ key: string; value: any }>;
  emails?: any[];
};

type Stage = {
  id: string;
  name: string;
  position: number;
  cards: Card[];
};

export default function KanbanPage() {
  const t = useTranslations('pipes');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
  const tApp = useTranslations('app');
  const tInbox = useTranslations('inbox');
  const params = useParams();
  const pipeId = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const [newCardTitle, setNewCardTitle] = useState("");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [formBuilderStageId, setFormBuilderStageId] = useState<string | null>(null);
  const [fieldDefinitions, setFieldDefinitions] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isDraggingEnabled, setIsDraggingEnabled] = useState(false);
  const [stageSortOrders, setStageSortOrders] = useState<Record<string, "newest" | "oldest">>({});
  const [openMenuStageId, setOpenMenuStageId] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [currentView, setCurrentView] = useState<"kanban" | "inbox">("kanban");

  // Inbox-specific state
  const [selectedFilter, setSelectedFilter] = useState<"all" | "unread">("all");
  const [selectedInboxStages, setSelectedInboxStages] = useState<string[]>([]);
  const [tempSelectedInboxStages, setTempSelectedInboxStages] = useState<string[]>([]);
  const [isStageDropdownOpen, setIsStageDropdownOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [openEmailMenuId, setOpenEmailMenuId] = useState<string | null>(null);
  const [emailToConfirmDelete, setEmailToConfirmDelete] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emailRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Compose email state
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [emailComposeView, setEmailComposeView] = useState<'inline' | 'popup'>('inline');
  const editorRef = useRef<RichTextEditorRef>(null);
  const composeEmailRef = useRef<HTMLDivElement>(null);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // Auto-fill search from URL parameter
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setSearchQuery(decodeURIComponent(searchFromUrl));
    }
  }, [searchParams]);

  // Load dragging preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("kanban-dragging-enabled");
    if (saved !== null) {
      setIsDraggingEnabled(saved === "true");
    }
  }, []);

  // Load sort preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("stage-sort-orders");
    if (saved) {
      try {
        setStageSortOrders(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse sort orders:", e);
      }
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuStageId(null);
    if (openMenuStageId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenuStageId]);

  // Save dragging preference to localStorage
  const toggleDragging = () => {
    const newValue = !isDraggingEnabled;
    setIsDraggingEnabled(newValue);
    localStorage.setItem("kanban-dragging-enabled", String(newValue));
  };

  // Handle sort order change
  const handleSortChange = (stageId: string, order: "newest" | "oldest") => {
    const newOrders = { ...stageSortOrders, [stageId]: order };
    setStageSortOrders(newOrders);
    localStorage.setItem("stage-sort-orders", JSON.stringify(newOrders));
    setOpenMenuStageId(null); // Close menu
  };

  // Handle duplicate pipe
  const handleDuplicatePipe = async () => {
    if (!confirm(t('duplicateConfirm'))) {
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

      showToast(`Pipe duplicated: ${result.newPipeName}`);

      // Redirect to the new pipe after a short delay
      setTimeout(() => {
        router.push(`/pipes/${result.newPipeId}`);
      }, 1000);
    } catch (error) {
      console.error("Error duplicating pipe:", error);
      alert(`${t('duplicateFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  // Load field definitions (key -> label mapping)
  useEffect(() => {
    fetch("/api/n8n-fields")
      .then(res => res.json())
      .then(data => {
        if (data.fields) {
          const labelMap: Record<string, string> = {};
          data.fields.forEach((f: any) => {
            labelMap[f.name] = f.label || f.name;
          });
          setFieldDefinitions(labelMap);
        }
      })
      .catch(err => console.error("Failed to load field definitions:", err));
  }, []);

  // Load display settings
  useEffect(() => {
    fetch("/api/kanban-display")
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          const visible = new Set<string>(
            data.settings
              .filter((s: any) => s.showOnCard)
              .map((s: any) => s.fieldName)
          );
          setVisibleFields(visible);
        }
      })
      .catch(err => console.error("Failed to load display settings:", err));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Query pipe with its stages and cards (including fields and emails)
  const { isLoading, error, data } = db.useQuery({
    pipes: {
      $: {
        where: {
          id: pipeId,
        },
      },
      email_templates: {},
      stages: {
        forms: {},
        cards: {
          fields: {},
          emails: {},
          form_submissions: {
            form: {},
          },
        },
      },
    },
    system_settings: {},
  });

  const { user } = db.useAuth();

  const pipe = data?.pipes?.[0];
  const stages = (pipe?.stages?.sort((a: any, b: any) => a.position - b.position) || []) as any[];
  const emailTemplates = pipe?.email_templates || [];
  const systemSettings = data?.system_settings?.[0];

  // Process emails for inbox view
  const allEmails: any[] = [];
  stages.forEach((stage: any) => {
    stage.cards?.forEach((card: any) => {
      card.emails?.forEach((email: any) => {
        allEmails.push({
          ...email,
          card: {
            id: card.id,
            title: card.title,
            description: card.description,
            stage: {
              id: stage.id,
              name: stage.name,
              backgroundColor: stage.backgroundColor,
            },
            fields: card.fields,
          },
        });
      });
    });
  });

  // Sort emails by sentAt descending
  allEmails.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));

  // Filter emails for inbox
  let filteredEmails = allEmails;
  if (selectedFilter === "unread") {
    filteredEmails = filteredEmails.filter((email) => !email.read);
  }
  if (selectedInboxStages.length > 0) {
    filteredEmails = filteredEmails.filter((email) =>
      selectedInboxStages.includes(email.card.stage.id)
    );
  }

  const displayedEmails = filteredEmails.slice(0, displayCount);
  const unreadCount = allEmails.filter((email) => !email.read).length;
  const selectedCardEmails = selectedEmail
    ? allEmails.filter((email) => email.card.id === selectedEmail.card.id)
    : [];

  // Helper functions for inbox
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const stripHtml = (html: string) => {
    if (typeof window === 'undefined') return html;
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
  };

  // Helper function to extract email addresses from "Name" <email@example.com> format
  const extractEmailAddresses = (emailString: string): string => {
    if (!emailString) return "";

    // Split by comma for multiple emails
    const emails = emailString.split(',').map(e => e.trim());

    // Extract email from format: "Display Name" <email@example.com>
    const cleanedEmails = emails.map(email => {
      const match = email.match(/<([^>]+)>/);
      return match ? match[1] : email;
    });

    return cleanedEmails.join(', ');
  };

  // Helper function to remove card ID from subject line
  const removeCardIdFromSubject = (subject: string): string => {
    // Remove pattern like " [#cardId]" from end of subject
    return subject.replace(/\s*\[#[^\]]+\]\s*$/g, '').trim();
  };

  // Helper function to extract display name from email string
  const extractDisplayName = (emailString: string): string => {
    if (!emailString) return "";

    // Check if format is: "Name" <email@example.com> or Name <email@example.com>
    const match = emailString.match(/^"?([^"<]+)"?\s*<?/);
    if (match && match[1]) {
      return match[1].trim();
    }

    // If no name found, return the email address
    return emailString.trim();
  };

  // Handle template selection
  const handleSelectTemplate = (templateId: string) => {
    const template = emailTemplates.find((t: any) => t.id === templateId);
    if (template && selectedEmail) {
      setSelectedTemplate(templateId);

      // Set template metadata
      setEmailCc(template.cc || "");
      setEmailBcc(template.bcc || "");
      setShowCc(!!template.cc);
      setShowBcc(!!template.bcc);

      const card = selectedEmail.card;
      const stage = stages.find((s: any) => s.id === card.stage.id);
      const formSubmissions = (card.form_submissions || []).sort((a: any, b: any) => b.submittedAt - a.submittedAt);
      const clientForms = (stage?.forms || []).filter((f: any) => f.formType !== "admin");

      const processedSubject = replacePlaceholders(template.subject, {
        card: {
          title: card.title,
          description: card.description,
          fields: card.fields || [],
        },
        stage: {
          name: stage?.name,
        },
        pipe: {
          name: pipe?.name,
        },
        formSubmissions: formSubmissions,
        globalVariables: systemSettings?.globalVariables || [],
        clientForms: clientForms,
        cardId: card.id,
      });

      const processedBody = replacePlaceholders(template.body, {
        card: {
          title: card.title,
          description: card.description,
          fields: card.fields || [],
        },
        stage: {
          name: stage?.name,
        },
        pipe: {
          name: pipe?.name,
        },
        formSubmissions: formSubmissions,
        globalVariables: systemSettings?.globalVariables || [],
        clientForms: clientForms,
        cardId: card.id,
      });

      setEmailSubject(processedSubject);
      setEmailBody(processedBody);
    }
  };

  // Handle send email
  const handleSendEmail = async () => {
    if (!emailTo) {
      alert("Please enter a recipient email address");
      return;
    }

    if (!emailSubject || !emailBody) {
      alert("Please fill in subject and body");
      return;
    }

    if (!selectedEmail) {
      alert("No card selected");
      return;
    }

    setSendingEmail(true);

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedEmail.card.id,
          to: emailTo,
          cc: emailCc || undefined,
          bcc: emailBcc || undefined,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email");
      }

      showToast("Email sent successfully!");

      // Clear compose form
      setShowEmailCompose(false);
      setEmailTo("");
      setEmailCc("");
      setEmailBcc("");
      setEmailSubject("");
      setEmailBody("");
      setShowCc(false);
      setShowBcc(false);
      setSelectedTemplate("");
      setShowTemplateSelector(false);
      setEmailComposeView('inline');
    } catch (error) {
      console.error("Error sending email:", error);
      alert(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle post comment
  const handlePostComment = async () => {
    if (!commentText.trim()) {
      showToast("Please enter a comment", "error");
      return;
    }

    if (!user?.email) {
      showToast("You must be signed in to comment", "error");
      return;
    }

    if (!selectedEmail?.card?.id) {
      showToast("No card selected", "error");
      return;
    }

    setSavingComment(true);

    try {
      const commentId = id();
      const now = Date.now();

      await db.transact([
        db.tx.card_comments[commentId]
          .update({
            author: user.email,
            body: commentText.trim(),
            createdAt: now,
          })
          .link({ card: selectedEmail.card.id }),
      ]);

      showToast("Comment posted successfully!");
      setCommentText("");
    } catch (error) {
      console.error("Failed to post comment:", error);
      showToast("Failed to post comment", "error");
    } finally {
      setSavingComment(false);
    }
  };

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showAccountMenu && !target.closest('.account-menu')) {
        setShowAccountMenu(false);
      }
    };

    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAccountMenu]);

  // Close manage menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showManageMenu && !target.closest('.manage-menu')) {
        setShowManageMenu(false);
      }
    };

    if (showManageMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showManageMenu]);

  // Inbox useEffects
  // Infinite scroll handler
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      if (displayCount < filteredEmails.length) {
        setDisplayCount((prev) => prev + 20);
      }
    }
  };

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl && currentView === "inbox") {
      scrollEl.addEventListener("scroll", handleScroll);
      return () => scrollEl.removeEventListener("scroll", handleScroll);
    }
  }, [displayCount, filteredEmails.length, currentView]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isStageDropdownOpen && !target.closest(".relative")) {
        setIsStageDropdownOpen(false);
      }
    };

    if (isStageDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isStageDropdownOpen]);

  // Close email menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openEmailMenuId) {
        const target = e.target as HTMLElement;
        // Check if click is outside the menu
        if (!target.closest('.email-menu-container')) {
          setOpenEmailMenuId(null);
          setEmailToConfirmDelete(null);
        }
      }
    };

    if (openEmailMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openEmailMenuId]);

  // Clear comment text when selected email changes
  useEffect(() => {
    setCommentText("");
  }, [selectedEmail?.id]);

  // Scroll to expanded email in column 3
  useEffect(() => {
    if (expandedEmailId && currentView === "inbox") {
      const emailElement = emailRefs.current.get(expandedEmailId);
      if (emailElement) {
        emailElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [expandedEmailId, currentView]);

  const handleSignOut = () => {
    db.auth.signOut();
  };

  const handleDeleteEmail = async (emailId: string) => {
    try {
      await db.transact([
        db.tx.card_emails[emailId].delete()
      ]);
      setOpenEmailMenuId(null);
      setEmailToConfirmDelete(null);

      // If the deleted email was selected, clear selection
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
        setExpandedEmailId(null);
      }
    } catch (error) {
      console.error("Error deleting email:", error);
      alert("Failed to delete email: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleCreateCard = async (stageId: string) => {
    if (!newCardTitle.trim()) return;

    const cardId = id();
    const now = Date.now();

    await db.transact([
      db.tx.cards[cardId].update({
        title: newCardTitle.trim(),
        description: "",
        createdAt: now,
        updatedAt: now,
      }).link({ pipe: pipeId, stage: stageId }),
    ]);

    setNewCardTitle("");
    setSelectedStageId(null);

    // Trigger automations for card entering stage
    try {
      console.log("🤖 Triggering automation for new card entering stage...", {
        cardId,
        pipeId,
        stageId,
      });

      const automationResult = await checkAndExecuteAutomations({
        triggerType: "card_enters_stage",
        cardId,
        pipeId,
        context: {
          stageId,
        },
      });

      console.log("✅ Automation executed:", automationResult);
    } catch (error) {
      console.error("❌ Error triggering automations:", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const cardId = active.id as string;
    const newStageId = over.id as string;

    // Find the card and its current stage
    const card = stages.flatMap((s: any) => s.cards).find((c: any) => c.id === cardId);
    const oldStage = stages.find((s: any) => s.cards?.some((c: any) => c.id === cardId));
    const newStage = stages.find((s: any) => s.id === newStageId);

    if (!card || !newStage) return;

    // Don't trigger automation if card is dropped back into the same stage
    if (oldStage?.id === newStageId) return;

    // Create history entry
    const historyId = id();

    // Update card's stage and create history entry
    await db.transact([
      db.tx.cards[cardId].update({
        updatedAt: Date.now(),
      }).link({ stage: newStageId }),
      db.tx.card_history[historyId].update({
        movedAt: Date.now(),
        fromStageId: oldStage?.id || null,
        toStageId: newStageId,
        fromStageName: oldStage?.name || null,
        toStageName: newStage.name,
      }).link({ card: cardId }),
    ]);

    // Trigger automations for card entering stage
    try {
      console.log("🤖 Triggering automation for card entering stage...", {
        cardId,
        pipeId,
        stageId: newStageId,
      });

      const automationResult = await checkAndExecuteAutomations({
        triggerType: "card_enters_stage",
        cardId,
        pipeId,
        context: {
          stageId: newStageId,
        },
      });

      console.log("✅ Automation executed:", automationResult);
      console.log(`📊 Automation Report:
  • Found: ${automationResult.automationsFound}
  • Matched: ${automationResult.automationsMatched}
  • Executed: ${automationResult.automationsExecuted?.length || 0}
  • Skipped: ${automationResult.automationsSkipped?.length || 0}
  • Failed: ${automationResult.automationsFailed?.length || 0}`);

      if (automationResult.details && automationResult.details.length > 0) {
        console.log("📝 Details:", automationResult.details);
      }
    } catch (error) {
      console.error("❌ Error triggering automations:", error);
      // Don't fail the card move if automation fails
    }

    // Optionally send event to API for n8n integration
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "card.moved",
          cardId,
          newStageId,
          pipeId,
        }),
      });
    } catch (err) {
      console.error("Failed to send event:", err);
    }
  };

  const activeCard = activeId
    ? stages.flatMap((s: any) => s.cards).find((c: any) => c.id === activeId)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !pipe) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{t('errorLoading')}</p>
          <Link href="/pipes" className="text-blue-600 hover:underline">
            {t('backToPipes')}
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
          {/* Top Header - FlowLane Brand */}
          <header className="bg-white">
            <div className="max-w-full px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-2">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{tApp('name')}</h1>
                </div>
                <div className="relative account-menu">
                  <button
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
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

          {/* Pipe Navigation Header */}
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-full px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-4">
                  <Link href="/pipes" className="text-sm text-gray-600 hover:text-gray-900">
                    ← {t('back')}
                  </Link>
                  <h1 className="text-base font-bold text-gray-900">{pipe.name}</h1>

                  {/* Search Box - Only show in Kanban view */}
                  {currentView === "kanban" && (
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('searchCards')}
                        className="pl-9 pr-9 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* View Toggle Buttons */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setCurrentView("kanban")}
                      className={`pb-1 text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                        currentView === "kanban"
                          ? "text-blue-600 border-b-2 border-blue-600"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-18v18m0-18h10a2 2 0 012 2v14a2 2 0 01-2 2h-10" />
                      </svg>
                      Kanban
                    </button>
                    <button
                      onClick={() => setCurrentView("inbox")}
                      className={`pb-1 text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                        currentView === "inbox"
                          ? "text-blue-600 border-b-2 border-blue-600"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </button>
                  </div>

                  {/* Drag Toggle */}
                  <button
                    onClick={toggleDragging}
                    className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer"
                    title={isDraggingEnabled ? "Click to disable card dragging" : "Click to enable card dragging"}
                  >
                    {/* Lock Icon */}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isDraggingEnabled ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      )}
                    </svg>

                    {/* Toggle Switch */}
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isDraggingEnabled ? "bg-green-500" : "bg-gray-300"
                    }`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        isDraggingEnabled ? "translate-x-5" : "translate-x-1"
                      }`} />
                    </div>

                    <span>
                      {isDraggingEnabled ? t('dragEnabled') : t('dragDisabled')}
                    </span>
                  </button>

                  {/* Manage Dropdown */}
                  <div className="relative manage-menu">
                    <button
                      onClick={() => setShowManageMenu(!showManageMenu)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                      title={t('manage')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showManageMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <Link
                          href={`/automations/${pipeId}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setShowManageMenu(false)}
                        >
                          {t('automations')}
                        </Link>
                        <Link
                          href={`/email-templates/${pipeId}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setShowManageMenu(false)}
                        >
                          {t('emailTemplates')}
                        </Link>
                        <Link
                          href={`/sms-templates/${pipeId}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setShowManageMenu(false)}
                        >
                          SMS Templates
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Content Area - Conditional based on view */}
          {currentView === "kanban" ? (
            // Kanban Board
            <main className="p-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(event) => setActiveId(event.active.id as string)}
              onDragEnd={(event) => {
                handleDragEnd(event);
                setHoveredStageId(null);
              }}
              onDragCancel={() => {
                setActiveId(null);
                setHoveredStageId(null);
              }}
            >
              <div className="flex gap-3 overflow-x-scroll h-[calc(100vh-140px)]">
                {stages.map((stage: any) => {
                  // Get sort order for this stage (default to "newest")
                  const sortOrder = stageSortOrders[stage.id] || "newest";

                  // Filter cards by search query (case-insensitive title match)
                  const filteredCards = (stage.cards || [])
                    .filter((card: any) =>
                      searchQuery.trim() === "" ||
                      card.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .sort((a: any, b: any) => {
                      // Sort by updatedAt based on preference
                      if (sortOrder === "newest") {
                        return (b.updatedAt || 0) - (a.updatedAt || 0); // Newest first
                      } else {
                        return (a.updatedAt || 0) - (b.updatedAt || 0); // Oldest first
                      }
                    });

                  return (
                  <div
                    key={stage.id}
                    id={stage.id}
                    className="flex-shrink-0 w-64 rounded-lg p-3 h-full overflow-y-auto flex flex-col"
                    style={{ backgroundColor: stage.backgroundColor || '#F3F4F6' }}
                  >
                    {/* Stage Header */}
                    <div className="mb-3">
                      <div className="flex justify-between items-start h-10">
                        <h2 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1 pr-2">
                          {stage.name}
                          <span className="ml-2 text-xs text-gray-500">
                            ({filteredCards.length}{searchQuery && ` of ${stage.cards?.length || 0}`})
                          </span>
                        </h2>
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuStageId(openMenuStageId === stage.id ? null : stage.id);
                            }}
                            className="text-gray-600 hover:text-gray-900 transition-colors cursor-pointer leading-none"
                            title={t('moreOptions')}
                          >
                            ⋮
                          </button>

                          {/* Dropdown Menu */}
                          {openMenuStageId === stage.id && (
                            <div
                              className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setFormBuilderStageId(stage.id);
                                  setOpenMenuStageId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <span>{t('createForm')}</span>
                              </button>
                              <div className="border-t border-gray-200"></div>
                              <button
                                onClick={() => handleSortChange(stage.id, "newest")}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <span>{t('newestFirst')}</span>
                                {sortOrder === "newest" && <span className="ml-auto text-blue-600">✓</span>}
                              </button>
                              <button
                                onClick={() => handleSortChange(stage.id, "oldest")}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <span>{t('oldestFirst')}</span>
                                {sortOrder === "oldest" && <span className="ml-auto text-blue-600">✓</span>}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fixed Divider Line */}
                    <div className="border-t border-gray-300 mb-3"></div>

                    {/* Drop Zone */}
                    <div
                      className="flex-1 space-y-2 overflow-y-auto"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setHoveredStageId(stage.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const cardId = e.dataTransfer.getData("cardId");
                        if (cardId) {
                          handleDragEnd({ active: { id: cardId }, over: { id: stage.id } } as any);
                        }
                      }}
                    >
                      {activeId && hoveredStageId === stage.id ? (
                        // Show drop message when dragging over this stage
                        <div className="flex items-center justify-center h-full text-gray-500 text-center p-8">
                          <div>
                            <div className="text-lg font-medium mb-2">Drop your card here to</div>
                            <div className="text-xl font-bold text-gray-700">{stage.name}</div>
                          </div>
                        </div>
                      ) : (
                        // Show normal cards list
                        filteredCards.map((card: any) => {
                        // Sort fields by position
                        const sortedFields = (card.fields || []).sort((a: any, b: any) =>
                          (a.position ?? 0) - (b.position ?? 0)
                        );

                        // Filter to only visible fields
                        const displayFields = sortedFields.filter((f: any) =>
                          visibleFields.has(f.key)
                        );

                        // Check for unread received emails
                        const hasUnreadReceivedEmails = (card.emails || []).some((e: any) => e.direction === "received" && !e.read);

                        // Format time ago (hours or days)
                        const formatTimeAgo = (timestamp: number) => {
                          const hours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
                          if (hours < 24) {
                            return `${hours}h`;
                          } else {
                            const days = Math.floor(hours / 24);
                            return `${days}d`;
                          }
                        };

                        // Calculate time since creation and last update
                        const timeSinceCreated = formatTimeAgo(card.createdAt);
                        const timeSinceUpdated = formatTimeAgo(card.updatedAt);

                        return (
                          <div
                            key={card.id}
                            draggable={isDraggingEnabled}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("cardId", card.id);
                              setActiveId(card.id);
                            }}
                            onDragEnd={() => setActiveId(null)}
                            onClick={() => setSelectedCard(card)}
                            className={`bg-white rounded-lg p-3 shadow hover:shadow-md transition-shadow ${
                              isDraggingEnabled ? "cursor-move" : "cursor-pointer"
                            }`}
                          >
                            {/* Title */}
                            <h3 className="font-bold text-gray-900 text-sm mb-2">{card.title}</h3>

                            {/* Display visible fields */}
                            {displayFields.length > 0 && (
                              <div className="space-y-1 text-xs mb-2">
                                {displayFields.map((field: any) => (
                                  <div key={field.id} className="flex items-start gap-2">
                                    <span className="text-gray-500 font-medium min-w-[80px]">
                                      {fieldDefinitions[field.key] || field.key}:
                                    </span>
                                    <span className="text-gray-700 flex-1">
                                      {field.value || <span className="text-gray-400 italic">empty</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Description */}
                            {card.description && (
                              <div
                                className="text-xs text-gray-600 line-clamp-2 mb-2"
                                dangerouslySetInnerHTML={{
                                  __html: replacePlaceholders(card.description, {
                                    card: {
                                      title: card.title,
                                      description: card.description,
                                      fields: card.fields || [],
                                    },
                                  }),
                                }}
                              />
                            )}

                            {/* Bottom indicators */}
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
                              {/* Left side: Time clocks */}
                              <div className="flex items-center gap-3">
                                {/* Created time - Reddish orange clock */}
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs text-gray-600">{timeSinceCreated}</span>
                                </div>

                                {/* Updated time - Blue refresh clock */}
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span className="text-xs text-gray-600">{timeSinceUpdated}</span>
                                </div>
                              </div>

                              {/* Right side: Email indicator */}
                              <div className="relative">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {hasUnreadReceivedEmails && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                      )}
                    </div>

                    {/* Add Card Form */}
                    {selectedStageId === stage.id ? (
                      <div className="mt-3">
                        <input
                          type="text"
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCreateCard(stage.id);
                            } else if (e.key === "Escape") {
                              setSelectedStageId(null);
                              setNewCardTitle("");
                            }
                          }}
                          placeholder="Card title..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateCard(stage.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            {tCommon('add')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStageId(null);
                              setNewCardTitle("");
                            }}
                            className="px-3 py-1 text-gray-600 rounded text-xs hover:bg-gray-200"
                          >
                            {tCommon('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      false && (
                        <button
                          onClick={() => setSelectedStageId(stage.id)}
                          className="mt-3 w-full px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-xs transition-colors text-left"
                        >
                          + 新增卡片 (Add card)
                        </button>
                      )
                    )}
                  </div>
                  );
                })}
              </div>

              <DragOverlay>
                {activeCard ? (
                  <div className="bg-white rounded-lg p-4 shadow-lg w-80 rotate-3 opacity-90">
                    <h3 className="font-medium text-gray-900">{activeCard.title}</h3>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </main>
          ) : (
            // Inbox View
            <div className="flex flex-1 overflow-hidden h-[calc(100vh-140px)]">
              {/* Column 1: Navigation Sidebar */}
              <div className="w-48 bg-white border-r border-gray-200 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-base font-semibold text-gray-900">Emails</h3>
                  </div>
                </div>

                {/* Navigation buttons */}
                <div className="p-4 flex flex-col gap-3">
                <button
                  onClick={() => setSelectedFilter("all")}
                  className={`px-2 py-2 rounded-lg text-left text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    selectedFilter === "all"
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  {tInbox('allMessages')}
                </button>

                <button
                  onClick={() => setSelectedFilter("unread")}
                  className={`px-2 py-2 rounded-lg text-left text-xs font-medium transition-colors flex items-center justify-between gap-1 ${
                    selectedFilter === "unread"
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                    </svg>
                    <span className="truncate">{tInbox('unreadMessages')}</span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </button>
                </div>
              </div>

              {/* Column 2: Email List */}
              <div className="w-56 bg-white border-r border-gray-200 flex flex-col">
                {/* Stage Filter */}
                <div className="p-4 border-b border-gray-200">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    {tInbox('filterByStage')}
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => {
                        setIsStageDropdownOpen(!isStageDropdownOpen);
                        setTempSelectedInboxStages(selectedInboxStages);
                      }}
                      className="w-full px-2 py-1.5 text-left border border-gray-300 rounded-lg text-xs hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="text-gray-700">
                        {selectedInboxStages.length === 0
                          ? tInbox('allStages')
                          : `${selectedInboxStages.length} ${selectedInboxStages.length > 1 ? tInbox('stagesSelected') : tInbox('stageSelected')}`}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>

                    {isStageDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                        <div className="p-1.5 max-h-48 overflow-y-auto">
                          {stages.map((stage: any) => (
                            <label
                              key={stage.id}
                              className="flex items-start gap-1.5 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={tempSelectedInboxStages.includes(stage.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTempSelectedInboxStages([...tempSelectedInboxStages, stage.id]);
                                  } else {
                                    setTempSelectedInboxStages(
                                      tempSelectedInboxStages.filter((id) => id !== stage.id)
                                    );
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                              />
                              <span className="text-xs text-gray-700">{stage.name}</span>
                            </label>
                          ))}
                        </div>
                        <div className="border-t border-gray-200 p-1.5 flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedInboxStages(tempSelectedInboxStages);
                              setIsStageDropdownOpen(false);
                              setDisplayCount(20);
                            }}
                            className="flex-1 px-2 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 font-medium"
                          >
                            {tCommon('apply')}
                          </button>
                          <button
                            onClick={() => {
                              setIsStageDropdownOpen(false);
                            }}
                            className="px-2 py-1.5 text-gray-600 text-xs rounded hover:bg-gray-100"
                          >
                            {tCommon('cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedInboxStages.length > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        {selectedInboxStages.length} {selectedInboxStages.length > 1 ? tInbox('stagesSelected') : tInbox('stageSelected')} {tInbox('selected')}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedInboxStages([]);
                          setDisplayCount(20);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {tCommon('clear')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Email List */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                  {displayedEmails.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p>{tInbox('noEmails')}</p>
                    </div>
                  ) : (
                    displayedEmails.map((email: any) => (
                      <div
                        key={email.id}
                        onClick={async () => {
                          if (!email.read) {
                            await db.transact([
                              db.tx.card_emails[email.id].update({ read: true })
                            ]);
                          }
                          setSelectedEmail(email);
                          setExpandedEmailId(email.id);
                        }}
                        className={`p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedEmail?.id === email.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {!email.read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                            )}
                            <span className={`text-xs truncate ${!email.read ? "font-bold" : "font-medium"}`}>
                              {extractDisplayName(email.from)}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0">
                            {formatDate(email.sentAt)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-900 truncate mb-1">{email.subject}</div>
                        <div className="text-xs text-gray-600 line-clamp-2 mb-1">{stripHtml(email.body)}</div>
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span className="text-xs text-gray-600 bg-gray-200 rounded px-1 py-0.5 truncate">
                            {email.card.title}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  {displayCount < filteredEmails.length && (
                    <div className="p-4 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Email Thread Viewer */}
              <div className="flex-1 bg-white overflow-y-auto">
                {!selectedEmail ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>{tInbox('selectEmail')}</p>
                  </div>
                ) : (
                  <div className="p-6">
                    <h2 className="text-base font-bold mb-4">
                      {tInbox('emailsFor')}: {selectedEmail.card.title}
                    </h2>

                    {/* Compose Email Box */}
                    {showEmailCompose && (
                      <>
                        {/* Inline Email Compose Box */}
                        {emailComposeView === 'inline' && (
                          <div ref={composeEmailRef} className="border border-gray-300 rounded-lg p-3 mb-4 bg-white shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-sm font-semibold text-gray-900">Compose Email</h3>
                              <button
                                onClick={() => setEmailComposeView('popup')}
                                className="text-gray-500 hover:text-gray-700"
                                title="Expand to popup"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                </svg>
                              </button>
                            </div>

                        {/* To Field */}
                        <div className="mb-2">
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            To
                          </label>
                          <input
                            type="text"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="recipient@example.com"
                          />
                          {/* Cc/Bcc Toggle Buttons */}
                          <div className="flex gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => setShowCc(!showCc)}
                              className={`px-2 py-0.5 text-[10px] rounded ${
                                showCc
                                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                                  : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                              }`}
                            >
                              Cc
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowBcc(!showBcc)}
                              className={`px-2 py-0.5 text-[10px] rounded ${
                                showBcc
                                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                                  : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                              }`}
                            >
                              Bcc
                            </button>
                            {emailTemplates.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                                className={`px-2 py-0.5 text-[10px] rounded ${
                                  showTemplateSelector
                                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                                    : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                                }`}
                              >
                                Template
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Template Selector */}
                        {showTemplateSelector && emailTemplates.length > 0 && (
                          <div className="mb-2">
                            <label className="block text-[11px] font-medium text-gray-700 mb-1">
                              Use Template (Optional)
                            </label>
                            <select
                              value={selectedTemplate}
                              onChange={(e) => handleSelectTemplate(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Select a template --</option>
                              {emailTemplates.map((template: any) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* CC Field */}
                        {showCc && (
                          <div className="mb-2">
                            <label className="block text-[11px] font-medium text-gray-700 mb-1">
                              CC (Optional)
                            </label>
                            <input
                              type="text"
                              value={emailCc}
                              onChange={(e) => setEmailCc(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                              placeholder="cc@example.com (comma-separated for multiple)"
                            />
                          </div>
                        )}

                        {/* BCC Field */}
                        {showBcc && (
                          <div className="mb-2">
                            <label className="block text-[11px] font-medium text-gray-700 mb-1">
                              BCC (Optional)
                            </label>
                            <input
                              type="text"
                              value={emailBcc}
                              onChange={(e) => setEmailBcc(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                              placeholder="bcc@example.com (comma-separated for multiple)"
                            />
                          </div>
                        )}

                        {/* Subject Field */}
                        <div className="mb-2">
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Subject
                          </label>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="Email subject"
                          />
                        </div>

                        {/* Body Field */}
                        <div className="mb-2">
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Message
                          </label>
                          <div className="max-h-[500px] overflow-y-auto">
                            <RichTextEditor
                              ref={editorRef}
                              value={emailBody}
                              onChange={setEmailBody}
                              placeholder="Email body..."
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSendEmail}
                            disabled={sendingEmail || !emailTo || !emailSubject || !emailBody}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingEmail ? "Sending..." : "Send Email"}
                          </button>
                          <button
                            onClick={() => {
                              setShowEmailCompose(false);
                              setEmailTo("");
                              setEmailCc("");
                              setEmailBcc("");
                              setEmailSubject("");
                              setEmailBody("");
                              setShowCc(false);
                              setShowBcc(false);
                              setSelectedTemplate("");
                              setShowTemplateSelector(false);
                              setEmailComposeView('inline');
                            }}
                            className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                        )}

                        {/* Popup Email Compose Box */}
                        {emailComposeView === 'popup' && (
                          <div
                            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
                            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                          >
                            <div className="mx-4" style={{ width: '1000px', height: '800px' }}>
                              <div className="border border-gray-300 rounded-lg p-4 bg-white shadow-2xl h-full overflow-y-auto">
                                <div className="flex justify-between items-center mb-2">
                                  <h3 className="text-sm font-semibold text-gray-900">Compose Email</h3>
                                  <button
                                    onClick={() => setEmailComposeView('inline')}
                                    className="text-gray-500 hover:text-gray-700"
                                    title="Minimize to inline"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                                    </svg>
                                  </button>
                                </div>

                                {/* To Field */}
                                <div className="mb-2">
                                  <label className="block text-[11px] font-medium text-gray-700 mb-1">
                                    To
                                  </label>
                                  <input
                                    type="text"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                                    placeholder="recipient@example.com"
                                  />
                                  {/* Cc/Bcc Toggle Buttons */}
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      type="button"
                                      onClick={() => setShowCc(!showCc)}
                                      className={`px-2 py-0.5 text-[10px] rounded ${
                                        showCc
                                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                                          : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                                      }`}
                                    >
                                      Cc
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowBcc(!showBcc)}
                                      className={`px-2 py-0.5 text-[10px] rounded ${
                                        showBcc
                                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                                          : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                                      }`}
                                    >
                                      Bcc
                                    </button>
                                    {emailTemplates.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                                        className={`px-2 py-0.5 text-[10px] rounded ${
                                          showTemplateSelector
                                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                                            : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                                        }`}
                                      >
                                        Template
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Template Selector */}
                                {showTemplateSelector && emailTemplates.length > 0 && (
                                  <div className="mb-2">
                                    <label className="block text-[11px] font-medium text-gray-700 mb-1">
                                      Use Template (Optional)
                                    </label>
                                    <select
                                      value={selectedTemplate}
                                      onChange={(e) => handleSelectTemplate(e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                      <option value="">-- Select a template --</option>
                                      {emailTemplates.map((template: any) => (
                                        <option key={template.id} value={template.id}>
                                          {template.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* CC Field */}
                                {showCc && (
                                  <div className="mb-2">
                                    <label className="block text-[11px] font-medium text-gray-700 mb-1">
                                      CC (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={emailCc}
                                      onChange={(e) => setEmailCc(e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                                      placeholder="cc@example.com (comma-separated for multiple)"
                                    />
                                  </div>
                                )}

                                {/* BCC Field */}
                                {showBcc && (
                                  <div className="mb-2">
                                    <label className="block text-[11px] font-medium text-gray-700 mb-1">
                                      BCC (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={emailBcc}
                                      onChange={(e) => setEmailBcc(e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                                      placeholder="bcc@example.com (comma-separated for multiple)"
                                    />
                                  </div>
                                )}

                                {/* Subject Field */}
                                <div className="mb-2">
                                  <label className="block text-[11px] font-medium text-gray-700 mb-1">
                                    Subject
                                  </label>
                                  <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                                    placeholder="Email subject"
                                  />
                                </div>

                                {/* Body Field */}
                                <div className="mb-2">
                                  <label className="block text-[11px] font-medium text-gray-700 mb-1">
                                    Message
                                  </label>
                                  <div className="max-h-[500px] overflow-y-auto">
                                    <RichTextEditor
                                      ref={editorRef}
                                      value={emailBody}
                                      onChange={setEmailBody}
                                      placeholder="Email body..."
                                    />
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSendEmail}
                                    disabled={sendingEmail || !emailTo || !emailSubject || !emailBody}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {sendingEmail ? "Sending..." : "Send Email"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowEmailCompose(false);
                                      setEmailTo("");
                                      setEmailCc("");
                                      setEmailBcc("");
                                      setEmailSubject("");
                                      setEmailBody("");
                                      setShowCc(false);
                                      setShowBcc(false);
                                      setSelectedTemplate("");
                                      setShowTemplateSelector(false);
                                      setEmailComposeView('inline');
                                    }}
                                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="space-y-4">
                      {selectedCardEmails.map((email: any) => (
                        <div
                          key={email.id}
                          ref={(el) => {
                            if (el) {
                              emailRefs.current.set(email.id, el);
                            } else {
                              emailRefs.current.delete(email.id);
                            }
                          }}
                          className={`border border-gray-200 rounded-lg ${
                            openEmailMenuId === email.id ? "" : "overflow-hidden"
                          } ${expandedEmailId === email.id ? "shadow-md" : ""}`}
                        >
                          <div
                            onClick={() =>
                              setExpandedEmailId(expandedEmailId === email.id ? null : email.id)
                            }
                            className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                                  {extractDisplayName(email.from).charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm mb-2 truncate">{extractDisplayName(email.from)}</div>
                                  <div className="text-sm text-gray-600 truncate">{email.subject}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                {email.sentVia === "automation" && (
                                  <span className="px-2 py-0.5 text-[10px] rounded bg-gray-200 text-gray-700">
                                    Auto
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 text-[10px] rounded ${
                                  email.direction === "sent"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}>
                                  {email.direction === "sent" ? "Sent" : "Received"}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  {formatDate(email.sentAt)}
                                </span>
                                <div className="relative email-menu-container">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenEmailMenuId(openEmailMenuId === email.id ? null : email.id);
                                    }}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  >
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                                    </svg>
                                  </button>
                                  {openEmailMenuId === email.id && (
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 py-1 w-40">
                                      {emailToConfirmDelete === email.id ? (
                                        // Confirmation UI
                                        <div className="px-3 py-2">
                                          <p className="text-xs text-gray-700 mb-2">Delete this email?</p>
                                          <div className="flex gap-1.5">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEmailToConfirmDelete(null);
                                              }}
                                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteEmail(email.id);
                                              }}
                                              className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        // Delete button
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEmailToConfirmDelete(email.id);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {expandedEmailId === email.id && (
                            <div className="p-4 bg-white">
                              <div className="mb-4 text-sm text-gray-600 space-y-1">
                                <div>
                                  <span className="font-medium">From:</span> {extractDisplayName(email.from)}
                                </div>
                                <div>
                                  <span className="font-medium">To:</span> {email.to}
                                </div>
                                {email.cc && (
                                  <div>
                                    <span className="font-medium">CC:</span> {email.cc}
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium">Subject:</span> {email.subject}
                                </div>
                              </div>
                              <div
                                className="prose max-w-none text-sm"
                                dangerouslySetInnerHTML={{ __html: email.body }}
                              />
                              <div className="mt-4 flex gap-2">
                                <button
                                  onClick={() => {
                                    setEmailTo(extractEmailAddresses(email.from));
                                    setEmailCc("");
                                    setEmailBcc("");
                                    setEmailSubject(`Re: ${removeCardIdFromSubject(email.subject).replace(/^Re:\s*/i, '')}`);
                                    setEmailBody(`<p><br><br></p><hr><p><em>On ${new Date(email.sentAt).toLocaleString()}, ${email.from} wrote:</em></p>${email.body}`);
                                    setShowCc(false);
                                    setShowBcc(false);
                                    setShowEmailCompose(true);
                                    setTimeout(() => {
                                      composeEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setTimeout(() => {
                                        editorRef.current?.focus();
                                      }, 100);
                                    }, 100);
                                  }}
                                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                  {tInbox('reply')}
                                </button>
                                <button
                                  onClick={() => {
                                    const replyAllTo = [email.from, email.to].filter(Boolean).join(', ');
                                    setEmailTo(extractEmailAddresses(replyAllTo));
                                    setEmailCc(email.cc || "");
                                    setEmailBcc("");
                                    setEmailSubject(`Re: ${removeCardIdFromSubject(email.subject).replace(/^Re:\s*/i, '')}`);
                                    setEmailBody(`<p><br><br></p><hr><p><em>On ${new Date(email.sentAt).toLocaleString()}, ${email.from} wrote:</em></p>${email.body}`);
                                    setShowCc(!!email.cc);
                                    setShowBcc(false);
                                    setShowEmailCompose(true);
                                    setTimeout(() => {
                                      composeEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setTimeout(() => {
                                        editorRef.current?.focus();
                                      }, 100);
                                    }, 100);
                                  }}
                                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                  {tInbox('replyAll')}
                                </button>
                                <button
                                  onClick={() => {
                                    setEmailTo("");
                                    setEmailCc("");
                                    setEmailBcc("");
                                    setEmailSubject(`Fwd: ${removeCardIdFromSubject(email.subject)}`);
                                    setEmailBody(`<p><br><br></p><hr><p><em>Forwarded message from ${email.from}:</em></p>${email.body}`);
                                    setShowCc(false);
                                    setShowBcc(false);
                                    setShowEmailCompose(true);
                                    setTimeout(() => {
                                      composeEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setTimeout(() => {
                                        editorRef.current?.focus();
                                      }, 100);
                                    }, 100);
                                  }}
                                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  {tInbox('forward')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Column 4: Card Details Sidebar */}
              <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto">
                {!selectedEmail ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>{tInbox('noCard')}</p>
                  </div>
                ) : (
                  <div className="p-6">
                    {/* Clickable Card */}
                    <div
                      onClick={() => setSelectedCard(selectedEmail.card)}
                      className="bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow cursor-pointer mb-6"
                    >
                      {/* Card Title */}
                      <h3 className="font-bold text-gray-900 text-sm mb-2">{selectedEmail.card.title}</h3>

                      {/* Only visible fields */}
                      {selectedEmail.card.fields && selectedEmail.card.fields.length > 0 && (
                        <div className="space-y-1 text-xs">
                          {selectedEmail.card.fields
                            .filter((field: any) => visibleFields.has(field.key))
                            .map((field: any) => (
                              <div key={field.key} className="flex items-start gap-2">
                                <span className="text-gray-500 font-medium min-w-[80px]">
                                  {fieldDefinitions[field.key] || field.key}:
                                </span>
                                <span className="text-gray-700 flex-1">
                                  {field.value || <span className="text-gray-400 italic">empty</span>}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Current Stage Section */}
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-xs font-medium text-gray-700 mb-2">{tInbox('currentPhase')}</h4>
                      <div
                        className="px-3 py-2 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: selectedEmail.card.stage.backgroundColor || "#e5e7eb",
                        }}
                      >
                        {selectedEmail.card.stage.name}
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Comments</h4>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Type your comment here"
                        rows={4}
                        disabled={savingComment}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      {commentText.trim().length > 0 && (
                        <button
                          onClick={handlePostComment}
                          disabled={savingComment}
                          className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed ml-auto block"
                        >
                          {savingComment ? "Posting..." : "Post"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card Detail Modal */}
          {selectedCard && (
            <CardModalNew card={selectedCard} onClose={() => setSelectedCard(null)} />
          )}

          {/* Form Builder Modal */}
          {formBuilderStageId && (
            <StageFormBuilder
              stageId={formBuilderStageId}
              onClose={() => setFormBuilderStageId(null)}
            />
          )}
        </div>
      </SignedIn>
    </div>
  );
}
