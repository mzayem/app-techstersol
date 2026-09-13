"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
  BoldIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  ForwardIcon,
  ImageIcon,
  InboxIcon,
  ItalicIcon,
  LinkIcon,
  Loader2Icon,
  PaperclipIcon,
  RefreshCwIcon,
  ReplyIcon,
  SendIcon,
  SquarePenIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  composeEmail,
  getInboxUnseenCount,
  listMailbox,
  readMailMessage,
  removeMailMessage,
  saveDraftEmail,
  setMessageFlagged,
  setMessageSeen,
} from "@/actions/mail/imap-actions";
import type { MailDetail, MailFolder, MailListItem } from "@/lib/mail/imap";

type FilterKey = "all" | "unread" | "read" | "starred";
type SortKey = "newest" | "oldest" | "largest" | "smallest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "largest", label: "Largest first" },
  { key: "smallest", label: "Smallest first" },
];

const FOLDERS: { key: MailFolder; label: string; icon: typeof InboxIcon }[] = [
  { key: "INBOX", label: "Inbox", icon: InboxIcon },
  { key: "INBOX.Sent", label: "Sent", icon: SendIcon },
  { key: "INBOX.Drafts", label: "Drafts", icon: FileTextIcon },
  { key: "INBOX.Trash", label: "Trash", icon: Trash2Icon },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All mail" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "starred", label: "Starred" },
];

const FOLDER_LABEL: Record<MailFolder, string> = {
  INBOX: "Inbox",
  "INBOX.Sent": "Sent",
  "INBOX.Drafts": "Drafts",
  "INBOX.Trash": "Trash",
};

function formatDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFullDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtmlClient(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Best-effort "Name <email>" → "email" extraction for prefilling the To
 * field from a stored draft — the compose form still validates on submit,
 * so a miss here just leaves the field blank for the admin to fill in. */
function extractEmail(raw: string): string {
  const angle = raw.match(/<([^>]+)>/);
  if (angle) return angle[1].trim();
  const bare = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bare) ? bare : "";
}

function replySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function forwardSubject(subject: string) {
  return /^fwd:/i.test(subject) ? subject : `Fwd: ${subject}`;
}

function quoteBlock(detail: MailDetail) {
  const original =
    detail.html ??
    `<div style="white-space:pre-wrap">${escapeHtmlClient(detail.text ?? "")}</div>`;
  return `<br><br><div style="border-left:2px solid #f3c28c;padding-left:12px;color:#6b7280;">
    <p>On ${escapeHtmlClient(formatFullDate(detail.date))}, ${escapeHtmlClient(detail.from)} wrote:</p>
    ${original}
  </div>`;
}

type ComposeTarget = {
  key: number;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  sourceDraft?: { folder: MailFolder; uid: number };
};

export function EmailsClient() {
  const [folder, setFolder] = React.useState<MailFolder>("INBOX");
  const [page, setPage] = React.useState(1);
  const [messages, setMessages] = React.useState<MailListItem[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [listError, setListError] = React.useState<string | null>(null);
  const [loadingList, startLoadingList] = React.useTransition();
  const [bulkAction, setBulkAction] = React.useState<"read" | "unread" | "delete" | null>(null);
  const [pendingDeleteUids, setPendingDeleteUids] = React.useState<Set<number>>(new Set());

  const [view, setView] = React.useState<"list" | "detail">("list");
  const [selectedUid, setSelectedUid] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<MailDetail | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [loadingDetail, startLoadingDetail] = React.useTransition();
  const [openingDraftUid, setOpeningDraftUid] = React.useState<number | null>(null);

  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [selectedUids, setSelectedUids] = React.useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = React.useState<SortKey>("newest");
  const [unseenCount, setUnseenCount] = React.useState(0);

  const [compose, setCompose] = React.useState<ComposeTarget | null>(null);
  const composeKeyRef = React.useRef(0);

  const loadList = React.useCallback((f: MailFolder, p: number) => {
    startLoadingList(async () => {
      try {
        const result = await listMailbox(f, p);
        setMessages(result.messages);
        setTotal(result.total);
        setListError(null);
        setSelectedUids(new Set());
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Couldn't load mailbox");
      }
    });
  }, []);

  const refreshUnseenCount = React.useCallback(() => {
    getInboxUnseenCount()
      .then(setUnseenCount)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    loadList(folder, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, page]);

  React.useEffect(() => {
    refreshUnseenCount();
  }, [refreshUnseenCount]);

  function selectFolder(f: MailFolder) {
    if (f === folder) return;
    setFolder(f);
    setPage(1);
    setMessages(null);
    setView("list");
    setSelectedUid(null);
    setDetail(null);
    setFilter("all");
  }

  function goToPage(p: number) {
    setPage(p);
    setMessages(null);
    setView("list");
    setSelectedUid(null);
    setDetail(null);
  }

  function openCompose(target: Omit<ComposeTarget, "key">) {
    composeKeyRef.current += 1;
    setCompose({ key: composeKeyRef.current, ...target });
  }

  function closeCompose() {
    setCompose(null);
  }

  function backToList() {
    setView("list");
    setSelectedUid(null);
    setDetail(null);
  }

  function openMessage(m: MailListItem) {
    setSelectedUid(m.uid);
    setView("detail");
    startLoadingDetail(async () => {
      try {
        const result = await readMailMessage(folder, m.uid);
        setDetail(result);
        setDetailError(null);
        if (result && !m.seen) {
          setMessages(
            (prev) => prev?.map((msg) => (msg.uid === m.uid ? { ...msg, seen: true } : msg)) ?? prev,
          );
          if (folder === "INBOX") refreshUnseenCount();
        }
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : "Couldn't load message");
      }
    });
  }

  function openDraft(m: MailListItem) {
    if (openingDraftUid) return;
    setOpeningDraftUid(m.uid);
    (async () => {
      try {
        const result = await readMailMessage(folder, m.uid);
        if (result) {
          openCompose({
            to: extractEmail(result.to),
            cc: "",
            bcc: "",
            subject: result.subject === "(no subject)" ? "" : result.subject,
            bodyHtml:
              result.html ??
              (result.text
                ? `<div style="white-space:pre-wrap">${escapeHtmlClient(result.text)}</div>`
                : ""),
            sourceDraft: { folder, uid: m.uid },
          });
        }
      } catch (err) {
        toast.add({
          title: err instanceof Error ? err.message : "Couldn't open draft",
          type: "error",
        });
      } finally {
        setOpeningDraftUid(null);
      }
    })();
  }

  function handleRowOpen(m: MailListItem) {
    if (folder === "INBOX.Drafts") openDraft(m);
    else openMessage(m);
  }

  async function toggleStar(uid: number, next: boolean) {
    setMessages((prev) => prev?.map((m) => (m.uid === uid ? { ...m, flagged: next } : m)) ?? prev);
    setDetail((d) => (d && d.uid === uid ? { ...d, flagged: next } : d));
    try {
      await setMessageFlagged(folder, uid, next);
    } catch {
      toast.add({ title: "Couldn't update star", type: "error" });
      loadList(folder, page);
    }
  }

  async function deleteOne(uid: number) {
    setPendingDeleteUids((prev) => new Set(prev).add(uid));
    try {
      await removeMailMessage(folder, uid);
      setMessages((prev) => prev?.filter((m) => m.uid !== uid) ?? prev);
      setTotal((t) => Math.max(0, t - 1));
      setSelectedUids((prev) => {
        if (!prev.has(uid)) return prev;
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
      if (selectedUid === uid) backToList();
      toast.add({
        title: folder === "INBOX.Trash" ? "Message deleted" : "Moved to Trash",
        type: "success",
      });
      if (folder === "INBOX") refreshUnseenCount();
    } catch (err) {
      toast.add({
        title: err instanceof Error ? err.message : "Couldn't delete message",
        type: "error",
      });
    } finally {
      setPendingDeleteUids((prev) => {
        if (!prev.has(uid)) return prev;
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  }

  function deleteSelected() {
    const uids = Array.from(selectedUids);
    if (uids.length === 0) return;
    setBulkAction("delete");
    (async () => {
      try {
        await Promise.all(uids.map((uid) => removeMailMessage(folder, uid)));
        setMessages((prev) => prev?.filter((m) => !uids.includes(m.uid)) ?? prev);
        setTotal((t) => Math.max(0, t - uids.length));
        setSelectedUids(new Set());
        toast.add({ title: `${uids.length} message(s) deleted`, type: "success" });
        if (folder === "INBOX") refreshUnseenCount();
      } catch (err) {
        toast.add({
          title: err instanceof Error ? err.message : "Couldn't delete messages",
          type: "error",
        });
        loadList(folder, page);
      } finally {
        setBulkAction(null);
      }
    })();
  }

  function markSelectedSeen(seen: boolean) {
    const uids = Array.from(selectedUids);
    if (uids.length === 0) return;
    setBulkAction(seen ? "read" : "unread");
    (async () => {
      try {
        await Promise.all(uids.map((uid) => setMessageSeen(folder, uid, seen)));
        setMessages(
          (prev) => prev?.map((m) => (uids.includes(m.uid) ? { ...m, seen } : m)) ?? prev,
        );
        setSelectedUids(new Set());
        if (folder === "INBOX") refreshUnseenCount();
      } catch (err) {
        toast.add({
          title: err instanceof Error ? err.message : "Couldn't update messages",
          type: "error",
        });
        loadList(folder, page);
      } finally {
        setBulkAction(null);
      }
    })();
  }

  function toggleSelect(uid: number) {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  const visibleMessages = React.useMemo(() => {
    let list = messages ?? [];
    if (filter === "unread") list = list.filter((m) => !m.seen);
    else if (filter === "read") list = list.filter((m) => m.seen);
    else if (filter === "starred") list = list.filter((m) => m.flagged);
    // `list` is newest-first as returned by the server — only sort when the
    // chosen order actually differs from that.
    if (sortKey === "oldest") list = [...list].reverse();
    else if (sortKey === "largest") list = [...list].sort((a, b) => b.size - a.size);
    else if (sortKey === "smallest") list = [...list].sort((a, b) => a.size - b.size);
    return list;
  }, [messages, filter, sortKey]);

  function toggleSelectAllVisible() {
    setSelectedUids((prev) => {
      const allSelected =
        visibleMessages.length > 0 && visibleMessages.every((m) => prev.has(m.uid));
      return allSelected ? new Set() : new Set(visibleMessages.map((m) => m.uid));
    });
  }

  function handleReply() {
    if (!detail) return;
    openCompose({
      to: detail.replyToAddress,
      cc: "",
      bcc: "",
      subject: replySubject(detail.subject),
      bodyHtml: quoteBlock(detail),
    });
  }

  function handleForward() {
    if (!detail) return;
    openCompose({
      to: "",
      cc: "",
      bcc: "",
      subject: forwardSubject(detail.subject),
      bodyHtml: quoteBlock(detail),
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="flex h-[calc(100svh-4rem)] min-h-0 overflow-hidden">
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border bg-muted/20 p-3 sm:flex">
        <Button
          className="mb-2 w-full justify-start gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() =>
            openCompose({ to: "", cc: "", bcc: "", subject: "", bodyHtml: "" })
          }
        >
          <SquarePenIcon className="size-4" />
          New message
        </Button>
        <nav className="flex flex-col gap-0.5">
          {FOLDERS.map(({ key, label, icon: Icon }) => {
            const isActive = folder === key;
            const isLoading = isActive && loadingList;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectFolder(key)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  {isLoading ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                  {label}
                </span>
                {key === "INBOX" && unseenCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
                    {unseenCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border p-3 sm:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h1 className="text-base font-medium">Mail</h1>
            <Button
              size="sm"
              className="gap-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() =>
                openCompose({ to: "", cc: "", bcc: "", subject: "", bodyHtml: "" })
              }
            >
              <SquarePenIcon className="size-4" />
              New
            </Button>
          </div>
          <Tabs value={folder} onValueChange={(v) => v && selectFolder(v as MailFolder)}>
            <TabsList className="w-full">
              {FOLDERS.map(({ key, label }) => (
                <TabsTrigger key={key} value={key} className="flex-1 gap-1.5">
                  {folder === key && loadingList && (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  )}
                  {label}
                  {key === "INBOX" && unseenCount > 0 ? ` (${unseenCount})` : ""}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {view === "list" ? (
          <MailList
            folder={folder}
            folderLabel={FOLDER_LABEL[folder]}
            messages={messages}
            visibleMessages={visibleMessages}
            loading={loadingList}
            error={listError}
            filter={filter}
            setFilter={setFilter}
            sortKey={sortKey}
            setSortKey={setSortKey}
            selectedUids={selectedUids}
            toggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAllVisible}
            bulkAction={bulkAction}
            onDeleteSelected={deleteSelected}
            onMarkSelectedSeen={markSelectedSeen}
            onOpenRow={handleRowOpen}
            onToggleStar={toggleStar}
            onDeleteOne={deleteOne}
            pendingDeleteUids={pendingDeleteUids}
            openingDraftUid={openingDraftUid}
            page={page}
            totalPages={totalPages}
            onPrevPage={() => goToPage(page - 1)}
            onNextPage={() => goToPage(page + 1)}
            onRefresh={() => loadList(folder, page)}
          />
        ) : (
          <MailDetailPane
            folder={folder}
            detail={detail}
            loading={loadingDetail}
            error={detailError}
            deleting={!!detail && pendingDeleteUids.has(detail.uid)}
            onBack={backToList}
            onToggleStar={toggleStar}
            onDelete={deleteOne}
            onReply={handleReply}
            onForward={handleForward}
          />
        )}
      </div>

      <Sheet
        open={!!compose}
        onOpenChange={(open) => {
          if (!open) closeCompose();
        }}
      >
        {compose && (
          <ComposeDrawer
            key={compose.key}
            target={compose}
            onClose={closeCompose}
            onSent={() => {
              closeCompose();
              loadList(folder, page);
              refreshUnseenCount();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function MailList({
  folder,
  folderLabel,
  messages,
  visibleMessages,
  loading,
  error,
  filter,
  setFilter,
  sortKey,
  setSortKey,
  selectedUids,
  toggleSelect,
  onToggleSelectAll,
  bulkAction,
  onDeleteSelected,
  onMarkSelectedSeen,
  onOpenRow,
  onToggleStar,
  onDeleteOne,
  pendingDeleteUids,
  openingDraftUid,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  onRefresh,
}: {
  folder: MailFolder;
  folderLabel: string;
  messages: MailListItem[] | null;
  visibleMessages: MailListItem[];
  loading: boolean;
  error: string | null;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  sortKey: SortKey;
  setSortKey: (s: SortKey) => void;
  selectedUids: Set<number>;
  toggleSelect: (uid: number) => void;
  onToggleSelectAll: () => void;
  bulkAction: "read" | "unread" | "delete" | null;
  onDeleteSelected: () => void;
  onMarkSelectedSeen: (seen: boolean) => void;
  onOpenRow: (m: MailListItem) => void;
  onToggleStar: (uid: number, next: boolean) => void;
  onDeleteOne: (uid: number) => void;
  pendingDeleteUids: Set<number>;
  openingDraftUid: number | null;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
}) {
  const allSelected =
    visibleMessages.length > 0 && visibleMessages.every((m) => selectedUids.has(m.uid));
  const showAsTo = folder === "INBOX.Sent" || folder === "INBOX.Drafts";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h1 className="text-lg font-medium">{folderLabel}</h1>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Sort messages" />}
            >
              <ArrowUpDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortKey}
                onValueChange={(v) => v && setSortKey(v as SortKey)}
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.key} value={option.key}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={onRefresh}>
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
          </Button>
          <div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={onPrevPage}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="tabular-nums">
              {page}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={onNextPage}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleSelectAll}
          disabled={visibleMessages.length === 0}
          aria-label="Select all"
          className="data-checked:border-primary data-checked:bg-primary"
        />
        {selectedUids.size > 0 ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedUids.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkAction !== null}
              onClick={() => onMarkSelectedSeen(true)}
            >
              {bulkAction === "read" && <Loader2Icon className="size-3.5 animate-spin" />}
              Mark read
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkAction !== null}
              onClick={() => onMarkSelectedSeen(false)}
            >
              {bulkAction === "unread" && <Loader2Icon className="size-3.5 animate-spin" />}
              Mark unread
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkAction !== null}
              onClick={onDeleteSelected}
            >
              {bulkAction === "delete" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <Trash2Icon className="size-3.5" />
              )}
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && !messages && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        )}
        {error && <div className="px-4 py-8 text-center text-sm text-destructive">{error}</div>}
        {messages && visibleMessages.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            {filter === "all" ? "No messages in this folder." : "No messages match this filter."}
          </div>
        )}
        {visibleMessages.map((m) => (
          <div
            key={m.uid}
            role="button"
            tabIndex={0}
            onClick={() => onOpenRow(m)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onOpenRow(m);
            }}
            className={cn(
              "group flex cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-3 hover:bg-muted/50",
              selectedUids.has(m.uid) && "bg-primary/10",
              (openingDraftUid === m.uid || pendingDeleteUids.has(m.uid)) && "opacity-60",
            )}
          >
            <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-2">
              <Checkbox
                checked={selectedUids.has(m.uid)}
                onCheckedChange={() => toggleSelect(m.uid)}
                aria-label="Select message"
                className="data-checked:border-primary data-checked:bg-primary"
              />
              <button
                type="button"
                onClick={() => onToggleStar(m.uid, !m.flagged)}
                aria-label={m.flagged ? "Unstar" : "Star"}
              >
                <StarIcon
                  className={cn(
                    "size-4",
                    m.flagged ? "fill-primary text-primary" : "text-muted-foreground",
                  )}
                />
              </button>
            </div>
            {!m.seen && <span className="size-2 shrink-0 rounded-full bg-primary" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", !m.seen && "font-semibold")}>
                  {showAsTo ? m.to || "(no recipient)" : m.from}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(m.date)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("truncate text-sm", !m.seen && "font-medium")}>
                  {m.subject}
                </span>
                {m.hasAttachment && (
                  <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!pendingDeleteUids.has(m.uid)) onDeleteOne(m.uid);
              }}
              disabled={pendingDeleteUids.has(m.uid)}
              aria-label="Delete"
              className={cn(
                "shrink-0 rounded-md p-1.5 text-muted-foreground transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100",
                pendingDeleteUids.has(m.uid) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              {pendingDeleteUids.has(m.uid) ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MailDetailPane({
  folder,
  detail,
  loading,
  error,
  deleting,
  onBack,
  onToggleStar,
  onDelete,
  onReply,
  onForward,
}: {
  folder: MailFolder;
  detail: MailDetail | null;
  loading: boolean;
  error: string | null;
  deleting: boolean;
  onBack: () => void;
  onToggleStar: (uid: number, next: boolean) => void;
  onDelete: (uid: number) => void;
  onReply: () => void;
  onForward: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2.5">
        <Button variant="ghost" size="icon-sm" aria-label="Back to list" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        {detail && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={detail.flagged ? "Unstar" : "Star"}
              onClick={() => onToggleStar(detail.uid, !detail.flagged)}
            >
              <StarIcon
                className={cn("size-4", detail.flagged && "fill-primary text-primary")}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={folder === "INBOX.Trash" ? "Delete permanently" : "Move to Trash"}
              disabled={deleting}
              onClick={() => onDelete(detail.uid)}
            >
              {deleting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading && !detail && (
          <div className="flex h-full items-center justify-center">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {detail && (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <div className="flex flex-col gap-1 border-b border-border pb-4">
              <h2 className="text-lg font-medium">{detail.subject}</h2>
              <p className="text-sm text-muted-foreground">From: {detail.from}</p>
              <p className="text-sm text-muted-foreground">To: {detail.to}</p>
              <p className="text-xs text-muted-foreground">{formatFullDate(detail.date)}</p>
            </div>
            {detail.html ? (
              <iframe
                title="Message body"
                srcDoc={detail.html}
                className="h-[45vh] w-full rounded-md border border-border bg-white"
                sandbox=""
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap">{detail.text}</div>
            )}
            {folder !== "INBOX.Trash" && (
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  className="gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/10"
                  onClick={onReply}
                >
                  <ReplyIcon className="size-4" />
                  Reply
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/10"
                  onClick={onForward}
                >
                  <ForwardIcon className="size-4" />
                  Forward
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function RichBodyEditor({
  initialHtml,
  onChange,
  placeholder,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  function emit() {
    onChange(ref.current?.innerHTML ?? "");
  }

  function exec(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  }

  function insertImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => exec("insertImage", String(reader.result));
    reader.readAsDataURL(file);
  }

  function insertLink() {
    const url = window.prompt("Link URL (https://…)");
    if (url) exec("createLink", url);
  }

  return (
    <div className="flex min-h-52 flex-1 flex-col overflow-hidden rounded-md ring-1 ring-foreground/10">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <ToolbarButton label="Bold" onClick={() => exec("bold")}>
          <BoldIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => exec("italic")}>
          <ItalicIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Insert link" onClick={insertLink}>
          <LinkIcon className="size-4" />
        </ToolbarButton>
        <label
          title="Insert image"
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ImageIcon className="size-4" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) insertImageFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        className="min-h-40 flex-1 overflow-y-auto px-3 py-2.5 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}

function ComposeDrawer({
  target,
  onClose,
  onSent,
}: {
  target: ComposeTarget;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = React.useState(target.to);
  const [showCcBcc, setShowCcBcc] = React.useState(!!(target.cc || target.bcc));
  const [cc, setCc] = React.useState(target.cc);
  const [bcc, setBcc] = React.useState(target.bcc);
  const [subject, setSubject] = React.useState(target.subject);
  const bodyHtmlRef = React.useRef(target.bodyHtml);
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = React.useState(0);
  const [sending, startSending] = React.useTransition();
  const [savingDraft, startSavingDraft] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setFileInputKey((k) => k + 1);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function buildFormData() {
    const formData = new FormData();
    formData.set("to", to.trim());
    formData.set("cc", cc);
    formData.set("bcc", bcc);
    formData.set("subject", subject);
    formData.set("bodyHtml", bodyHtmlRef.current);
    for (const file of files) formData.append("attachments", file);
    if (target.sourceDraft) {
      formData.set("sourceDraftFolder", target.sourceDraft.folder);
      formData.set("sourceDraftUid", String(target.sourceDraft.uid));
    }
    return formData;
  }

  function handleSend() {
    setError(null);
    startSending(async () => {
      try {
        await composeEmail(buildFormData());
        toast.add({ title: `Email sent to ${to}`, type: "success" });
        onSent();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't send email");
      }
    });
  }

  function handleSaveDraft() {
    setError(null);
    startSavingDraft(async () => {
      try {
        await saveDraftEmail(buildFormData());
        toast.add({ title: "Draft saved", type: "success" });
        onSent();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save draft");
      }
    });
  }

  const pending = sending || savingDraft;

  return (
    <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-xl!">
      <SheetHeader className="border-b border-border">
        <SheetTitle>{target.sourceDraft ? "Edit draft" : "New message"}</SheetTitle>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">To</span>
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Add Cc/Bcc
              </button>
            )}
          </div>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com"
            disabled={pending}
          />
        </label>
        {showCcBcc && (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Cc</span>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                disabled={pending}
                placeholder="name@example.com, another@example.com"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Bcc</span>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                disabled={pending}
                placeholder="name@example.com, another@example.com"
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Subject</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={pending} />
        </label>

        <RichBodyEditor
          initialHtml={target.bodyHtml}
          onChange={(html) => {
            bodyHtmlRef.current = html;
          }}
          placeholder="Write your message…"
        />

        <div className="flex flex-col gap-2">
          <label
            className={cn(
              "flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground",
              pending && "pointer-events-none opacity-50",
            )}
          >
            <PaperclipIcon className="size-3.5" />
            Attach files
            <input
              key={fileInputKey}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
          {files.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate">{file.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeFile(index)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <SheetFooter className="flex-row items-center justify-between border-t border-border">
        <Button variant="ghost" size="icon-sm" aria-label="Discard" disabled={pending} onClick={onClose}>
          <Trash2Icon className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={pending} loading={savingDraft} onClick={handleSaveDraft}>
            {savingDraft ? "Saving…" : "Save draft"}
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={pending}
            loading={sending}
            onClick={handleSend}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  );
}
