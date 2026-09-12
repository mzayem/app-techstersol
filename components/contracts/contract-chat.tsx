"use client";

import * as React from "react";
import {
  InfoIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SendIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import {
  createContractMessage,
  listContractMessages,
  type ContractMessageEntry,
} from "@/actions/contracts/messages";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

/** Splits on URLs (capturing group keeps them in the split result at the
 * odd indices) and renders each as a clickable link — the only way to
 * "attach" anything here, since there's no file upload. Trailing
 * punctuation like a sentence's closing period is kept out of the href. */
function linkify(text: string): React.ReactNode {
  return text.split(URL_PATTERN).map((part, i) => {
    if (i % 2 === 0) return part;
    const trailing = part.match(/[),.!?]+$/)?.[0] ?? "";
    const url = trailing ? part.slice(0, -trailing.length) : part;
    return (
      <React.Fragment key={i}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:no-underline break-all"
        >
          {url}
        </a>
        {trailing}
      </React.Fragment>
    );
  });
}

function formatMessageTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Icon button that opens a given contract's chat sheet — drop into any
 * contract/project row, in either the admin dashboard or the team portal;
 * the server action behind it authorizes whichever side is calling. */
export function ContractChatButton({
  contractId,
  projectName,
}: {
  contractId: string;
  projectName: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Open chat for ${projectName}`}
              onClick={() => setOpen(true)}
            />
          }
        >
          <MessageSquareTextIcon />
        </TooltipTrigger>
        <TooltipContent>Project chat</TooltipContent>
      </Tooltip>
      <ContractChatSheet
        contractId={contractId}
        projectName={projectName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function ContractChatSheet({
  contractId,
  projectName,
  open,
  onOpenChange,
}: {
  contractId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = React.useState<ContractMessageEntry[] | null>(
    null,
  );
  const [loading, startLoading] = React.useTransition();
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [body, setBody] = React.useState("");
  const [sending, startSending] = React.useTransition();
  const listRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(() => {
    startLoading(async () => {
      try {
        const data = await listContractMessages(contractId);
        setMessages(data);
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Couldn't load messages",
        );
      }
    });
  }, [contractId]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  React.useEffect(() => {
    if (!messages) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    startSending(async () => {
      try {
        const message = await createContractMessage(contractId, trimmed);
        setMessages((prev) => [...(prev ?? []), message]);
        setBody("");
      } catch (error) {
        toast.add({
          title:
            error instanceof Error ? error.message : "Couldn't send message",
          type: "error",
        });
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "gap-0 overflow-hidden rounded-2xl p-0 ring-1 ring-foreground/10",
          "data-[side=bottom]:inset-x-4 data-[side=bottom]:bottom-4 data-[side=bottom]:mx-auto data-[side=bottom]:h-[min(640px,80vh)] data-[side=bottom]:w-auto data-[side=bottom]:max-w-sm data-[side=bottom]:border-t-0",
          "sm:data-[side=bottom]:right-4 sm:data-[side=bottom]:left-auto sm:data-[side=bottom]:mx-0 sm:data-[side=bottom]:w-95",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b p-4">
          <div className="flex flex-col gap-0.5">
            <SheetTitle>{projectName}</SheetTitle>
            <SheetDescription>Notes and messages for this project</SheetDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    onClick={load}
                    aria-label="Refresh messages"
                  />
                }
              >
                <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="Close chat"
                />
              }
            >
              <XIcon className="size-3.5" />
            </SheetClose>
          </div>
        </div>

        <div
          ref={listRef}
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {loading && !messages && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          )}

          {!messages && loadError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button size="sm" variant="outline" onClick={load}>
                Try again
              </Button>
            </div>
          )}

          {messages?.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-dashed border-border">
                <MessageSquareTextIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-foreground">
                  No messages yet
                </p>
                <p className="text-sm">Start the conversation about this project.</p>
              </div>
            </div>
          )}

          {messages?.map((message) => (
              <div key={message.id} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {message.authorName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatMessageTime(message.createdAt)}
                  </span>
                </div>
                <div className="w-fit max-w-full rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap wrap-break-word">
                  {linkify(message.body)}
                </div>
              </div>
            ))}
        </div>

        <div className="p-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-muted p-2">
            <Textarea
              placeholder="Write a note for this project…"
              className="min-h-9 resize-none border-none bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <div className="flex items-center justify-between px-0.5 pb-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-full bg-background"
                      aria-label="About attachments"
                    />
                  }
                >
                  <InfoIcon className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-56">
                  No file uploads here — for media, upload it to Drive and
                  paste the link. Links you type become clickable automatically.
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                size="icon-sm"
                className="rounded-full"
                aria-label="Send message"
                disabled={sending || !body.trim()}
                onClick={handleSend}
              >
                {sending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SendIcon className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
