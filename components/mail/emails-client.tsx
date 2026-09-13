"use client";

import * as React from "react";
import { Loader2Icon, PaperclipIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  composeEmail,
  listMailbox,
  readMailMessage,
} from "@/actions/mail/imap-actions";
import type { MailDetail, MailFolder, MailListItem } from "@/lib/mail/imap";

function formatDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function EmailsClient() {
  const [folder, setFolder] = React.useState<MailFolder>("INBOX");
  const [page, setPage] = React.useState(1);
  const [messages, setMessages] = React.useState<MailListItem[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [listError, setListError] = React.useState<string | null>(null);
  const [loadingList, startLoadingList] = React.useTransition();

  const [selectedUid, setSelectedUid] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<MailDetail | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [loadingDetail, startLoadingDetail] = React.useTransition();

  const loadList = React.useCallback((f: MailFolder, p: number) => {
    startLoadingList(async () => {
      try {
        const result = await listMailbox(f, p);
        setMessages(result.messages);
        setTotal(result.total);
        setListError(null);
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Couldn't load mailbox");
      }
    });
  }, []);

  React.useEffect(() => {
    loadList(folder, page);
  }, [folder, page, loadList]);

  function selectFolder(f: MailFolder) {
    setFolder(f);
    setPage(1);
    setSelectedUid(null);
    setDetail(null);
  }

  function goToPage(p: number) {
    setPage(p);
    setSelectedUid(null);
    setDetail(null);
  }

  function openMessage(uid: number) {
    setSelectedUid(uid);
    startLoadingDetail(async () => {
      try {
        const result = await readMailMessage(folder, uid);
        setDetail(result);
        setDetailError(null);
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : "Couldn't load message");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Live inbox and sent mail from account@techstersol.com — nothing here is stored in
            our own database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Refresh"
            onClick={() => loadList(folder, page)}
          >
            <RefreshCwIcon className={cn("size-4", loadingList && "animate-spin")} />
          </Button>
          <ComposeDialog />
        </div>
      </div>

      <Tabs
        value={folder}
        onValueChange={(v) => {
          if (v) selectFolder(v as MailFolder);
        }}
      >
        <TabsList>
          <TabsTrigger value="INBOX">Inbox</TabsTrigger>
          <TabsTrigger value="INBOX.Sent">Sent</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-2 rounded-md bg-card ring-1 ring-foreground/10">
          {loadingList && !messages && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          )}
          {listError && (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-destructive">
              {listError}
            </div>
          )}
          {messages?.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No messages in this folder.
            </div>
          )}
          {messages?.map((m) => (
            <button
              key={m.uid}
              type="button"
              onClick={() => openMessage(m.uid)}
              className={cn(
                "flex flex-col gap-1 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted/50",
                selectedUid === m.uid && "bg-muted",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", !m.seen && "font-semibold")}>
                  {folder === "INBOX" ? m.from : m.to}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(m.date)}
                </span>
              </div>
              <span className={cn("truncate text-sm", !m.seen && "font-medium")}>
                {m.subject}
              </span>
            </button>
          ))}
          {total > 25 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Newer
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Older
              </Button>
            </div>
          )}
        </div>

        <div className="min-h-64 rounded-md bg-card p-6 ring-1 ring-foreground/10">
          {!selectedUid && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a message to read it.
            </div>
          )}
          {selectedUid && loadingDetail && !detail && (
            <div className="flex h-full items-center justify-center">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {detailError && <p className="text-sm text-destructive">{detailError}</p>}
          {detail && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 border-b pb-4">
                <h2 className="text-base font-medium">{detail.subject}</h2>
                <p className="text-sm text-muted-foreground">From: {detail.from}</p>
                <p className="text-sm text-muted-foreground">To: {detail.to}</p>
                <p className="text-xs text-muted-foreground">{formatDate(detail.date)}</p>
              </div>
              {detail.html ? (
                <iframe
                  title="Message body"
                  srcDoc={detail.html}
                  className="h-[50vh] w-full rounded-md border border-border"
                  sandbox=""
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap">{detail.text}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ComposeDialog() {
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState("");
  const [showCcBcc, setShowCcBcc] = React.useState(false);
  const [cc, setCc] = React.useState("");
  const [bcc, setBcc] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = React.useState(0);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function resetForm() {
    setTo("");
    setShowCcBcc(false);
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    setFiles([]);
    setFileInputKey((k) => k + 1);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setFileInputKey((k) => k + 1); // reset the picker so choosing the same file again still fires onChange
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("to", to);
        formData.set("cc", cc);
        formData.set("bcc", bcc);
        formData.set("subject", subject);
        formData.set("bodyText", body);
        for (const file of files) formData.append("attachments", file);

        await composeEmail(formData);
        toast.add({ title: `Email sent to ${to}`, type: "success" });
        resetForm();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't send email");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Compose
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
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
            />
          </label>
          {showCcBcc && (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">Cc</span>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="name@example.com, another@example.com"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">Bcc</span>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="name@example.com, another@example.com"
                />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Message</span>
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
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
        <DialogFooter>
          <Button loading={pending} onClick={handleSend}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
