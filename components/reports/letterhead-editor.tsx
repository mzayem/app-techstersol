"use client";

import * as React from "react";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import TiptapImage from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
  ImagePlusIcon,
  Code2Icon,
  DownloadIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VerifyPasswordDialog } from "@/components/reports/verify-password-dialog";
import {
  LETTERHEAD_FONT_FAMILIES,
  LETTERHEAD_FONT_SIZES,
  LETTERHEAD_LINE_SPACINGS,
  LETTERHEAD_DEFAULT_LINE_HEIGHT,
} from "@/lib/reports/letterhead/fonts";

const DEFAULT_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function todayFormatted() {
  return DEFAULT_DATE_FORMAT.format(new Date()).replace(",", "");
}

// Inserted images are downscaled client-side before they ever reach the
// editor or the PDF — keeps the request payload and the final PDF's file
// size sane regardless of what the user picks (a phone photo, a full-page
// screenshot, ...).
const MAX_IMAGE_DIMENSION_PX = 1000;

function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Could not load the image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION_PX || height > MAX_IMAGE_DIMENSION_PX) {
          const scale = MAX_IMAGE_DIMENSION_PX / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function LetterheadEditor() {
  const [label, setLabel] = React.useState("BUSINESS DECLARATION");
  const [date, setDate] = React.useState(todayFormatted);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [signOffMode, setSignOffMode] = React.useState<"filled" | "blank">("filled");
  const [name, setName] = React.useState("Muhammad Zayem");
  const [role, setRole] = React.useState("Owner / Software Developer");

  const [includeSignature, setIncludeSignature] = React.useState(false);
  const [signaturePassword, setSignaturePassword] = React.useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

  const [fontFamily, setFontFamily] = React.useState<string>(LETTERHEAD_FONT_FAMILIES[0].value);
  const [fontSize, setFontSize] = React.useState(10.5);
  const [color, setColor] = React.useState("#1b1b1b");
  const [lineHeight, setLineHeight] = React.useState(LETTERHEAD_DEFAULT_LINE_HEIGHT);
  const [imageError, setImageError] = React.useState<string | null>(null);

  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // A real editor (TipTap/ProseMirror) instead of contentEditable +
  // document.execCommand — execCommand is deprecated, has always been
  // inconsistent across browsers (that's the "bold not working right"),
  // doesn't support Ctrl/Cmd+B-style shortcuts reliably, and is flaky on
  // mobile touch input. TipTap handles all of that natively.
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["paragraph"] }),
      TiptapImage.configure({ allowBase64: true }),
    ],
    editorProps: {
      attributes: {
        // Tailwind's base reset strips list-style from every <ul>/<ol> on
        // the page — without restoring it here, TipTap's bullet/ordered
        // lists were creating real <li> markup with no visible marker at
        // all, which just looked like the button did nothing.
        class:
          "min-h-48 rounded-b-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_img]:my-1 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-sm [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1",
      },
    },
  });

  // Bold/italic/underline/bullet-list/alignment toggle state, read
  // reactively off the editor so the toolbar buttons highlight to match
  // the cursor's actual formatting — TipTap's recommended pattern for this.
  const activeMarks = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor?.isActive("bold") ?? false,
      italic: ctx.editor?.isActive("italic") ?? false,
      underline: ctx.editor?.isActive("underline") ?? false,
      bulletList: ctx.editor?.isActive("bulletList") ?? false,
      alignLeft: ctx.editor?.isActive({ textAlign: "left" }) ?? false,
      alignCenter: ctx.editor?.isActive({ textAlign: "center" }) ?? false,
      alignRight: ctx.editor?.isActive({ textAlign: "right" }) ?? false,
      alignJustify: ctx.editor?.isActive({ textAlign: "justify" }) ?? false,
    }),
  });

  const [showSource, setShowSource] = React.useState(false);
  const [sourceHtml, setSourceHtml] = React.useState("");

  function toggleSourceView() {
    if (!editor) return;
    if (showSource) {
      editor.commands.setContent(sourceHtml);
      setShowSource(false);
    } else {
      setSourceHtml(editor.getHTML());
      setShowSource(true);
    }
  }

  function handleFontFamilyChange(value: string) {
    setFontFamily(value);
    editor?.chain().focus().setFontFamily(value).run();
  }

  function handleFontSizeChange(value: string) {
    setFontSize(Number(value));
    editor?.chain().focus().setFontSize(`${value}pt`).run();
  }

  function handleColorChange(value: string) {
    setColor(value);
    editor?.chain().focus().setColor(value).run();
  }

  function handleInsertImageClick() {
    fileInputRef.current?.click();
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file");
      return;
    }
    setImageError(null);
    try {
      const dataUrl = await downscaleImage(file);
      editor?.chain().focus().setImage({ src: dataUrl }).run();
    } catch {
      setImageError("Failed to add that image");
    }
  }

  function handleSignatureToggle(checked: boolean) {
    if (checked) {
      setPasswordDialogOpen(true);
    } else {
      setIncludeSignature(false);
      setSignaturePassword(null);
    }
  }

  function handleVerified(password: string) {
    setSignaturePassword(password);
    setIncludeSignature(true);
  }

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/reports/letterhead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            date,
            bodyHtml: (showSource ? sourceHtml : editor?.getHTML()) ?? "",
            lineHeight,
            signOff: {
              mode: signOffMode,
              name,
              role,
              includeSignature,
              password: includeSignature ? (signaturePassword ?? undefined) : undefined,
            },
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Failed to generate the letter");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${(label || "letter").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Failed to generate the letter");
      }
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. BUSINESS DECLARATION"
          />
        </Field>
        <Field label="Date">
          <Input value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Letter body">
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 p-1.5">
          <Button
            type="button"
            variant={activeMarks?.bold ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Bold"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <BoldIcon />
          </Button>
          <Button
            type="button"
            variant={activeMarks?.italic ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Italic"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon />
          </Button>
          <Button
            type="button"
            variant={activeMarks?.underline ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Underline"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button
            type="button"
            variant={activeMarks?.bulletList ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Bullet list"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <ListIcon />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button
            type="button"
            variant={activeMarks?.alignLeft ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Align left"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeftIcon />
          </Button>
          <Button
            type="button"
            variant={activeMarks?.alignCenter ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Align center"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenterIcon />
          </Button>
          <Button
            type="button"
            variant={activeMarks?.alignRight ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Align right"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          >
            <AlignRightIcon />
          </Button>
          <Button
            type="button"
            variant={activeMarks?.alignJustify ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Justify"
            disabled={!editor || showSource}
            onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustifyIcon />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-5" />

          <Select
            value={fontFamily}
            onValueChange={(value) => value && handleFontFamilyChange(value)}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LETTERHEAD_FONT_FAMILIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(fontSize)}
            onValueChange={(value) => value && handleFontSizeChange(value)}
          >
            <SelectTrigger className="h-8 w-18 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LETTERHEAD_FONT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}pt
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-input bg-background"
            title="Text color"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => handleColorChange(e.target.value)}
              className="size-5 cursor-pointer appearance-none border-none bg-transparent p-0"
              aria-label="Text color"
            />
          </label>

          <Select value={String(lineHeight)} onValueChange={(v) => v && setLineHeight(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LETTERHEAD_LINE_SPACINGS.map((l) => (
                <SelectItem key={l.value} value={String(l.value)}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Insert image"
            disabled={!editor || showSource}
            onClick={handleInsertImageClick}
          >
            <ImagePlusIcon />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button
            type="button"
            variant={showSource ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={showSource ? "Back to visual editor" : "View HTML source"}
            title={showSource ? "Back to visual editor" : "View HTML source"}
            disabled={!editor}
            onClick={toggleSourceView}
          >
            <Code2Icon />
          </Button>
        </div>
        {showSource ? (
          <textarea
            value={sourceHtml}
            onChange={(e) => setSourceHtml(e.target.value)}
            spellCheck={false}
            className="min-h-48 w-full rounded-b-md border border-input bg-background p-3 font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          // Line spacing is applied live here too — not just at PDF
          // generation time — so what you see while writing matches the
          // downloaded PDF.
          <EditorContent editor={editor} style={{ lineHeight }} />
        )}
        {imageError && <p className="text-xs text-destructive">{imageError}</p>}
      </Field>

      <div className="flex flex-col gap-3 rounded-md border border-input p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Sign-off name &amp; role</p>
            <p className="text-xs text-muted-foreground">
              Filled prints the name and role below the signature line; blank prints empty lines
              for someone to sign by hand.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(signOffMode === "blank" && "font-medium")}>Blank</span>
            <Switch
              checked={signOffMode === "filled"}
              onCheckedChange={(checked) => setSignOffMode(checked ? "filled" : "blank")}
            />
            <span className={cn(signOffMode === "filled" && "font-medium")}>Filled</span>
          </div>
        </div>

        {signOffMode === "filled" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Role">
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <div>
            <p className="text-sm font-medium">Add signature &amp; stamp</p>
            <p className="text-xs text-muted-foreground">
              Requires confirming your password every time this is on.
            </p>
          </div>
          <Switch checked={includeSignature} onCheckedChange={handleSignatureToggle} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button onClick={handleDownload} loading={pending}>
          <DownloadIcon />
          Download PDF
        </Button>
      </div>

      <VerifyPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onVerified={handleVerified}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
