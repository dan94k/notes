"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { ResizableImageExtension } from "@/extensions/resizable-image";
import { DragHandle } from "@/extensions/drag-handle";
import { useEffect, useRef, useCallback, useState } from "react";

interface EditorProps {
  pageId: string;
  saveStatus: "saved" | "saving" | "dirty";
  onSaveStatus: (status: "saved" | "saving" | "dirty") => void;
}

export default function Editor({ pageId, saveStatus, onSaveStatus }: EditorProps) {
  const isDirty = useRef(false);
  const currentContent = useRef("");
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPageId = useRef<string | null>(null);
  const [, forceUpdate] = useState(0);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Comece a escrever..." }),
      Typography,
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Subscript,
      Superscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImageExtension.configure({
        inline: false,
        allowBase64: false,
      }),
      DragHandle,
    ],
    editorProps: {
      attributes: {
        class:
          "max-w-none min-h-[calc(100vh-8rem)] px-8 py-6 outline-none focus:outline-none text-sm text-neutral-300 leading-relaxed",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files.length) return false;
        const file = event.dataTransfer.files[0];
        if (!file.type.startsWith("image/")) return false;
        event.preventDefault();
        uploadAndInsertImage(file);
        return true;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              uploadAndInsertImage(file);
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: () => {
      isDirty.current = true;
      onSaveStatus("dirty");
    },
    onTransaction: () => {
      forceUpdate((n) => n + 1);
    },
  });

  // Load page content (save previous page if dirty)
  useEffect(() => {
    if (!editor || !pageId) return;

    async function loadPage() {
      // Save previous page if it had unsaved changes
      if (isDirty.current && prevPageId.current && prevPageId.current !== pageId) {
        const html = editor!.getHTML();
        await fetch(`/api/pages/${prevPageId.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
        isDirty.current = false;
      }
      prevPageId.current = pageId;

      const res = await fetch(`/api/pages/${pageId}`);
      if (res.ok) {
        const page = await res.json();
        const content = page.content || "";
        editor!.commands.setContent(content);
        currentContent.current = content;
        isDirty.current = false;
        onSaveStatus("saved");
      }
    }
    loadPage();
  }, [pageId, editor, onSaveStatus]);

  // Auto-save every 30 seconds (only if dirty)
  const autoSave = useCallback(async () => {
    if (!isDirty.current || !editor || !pageId) return;
    onSaveStatus("saving");
    const html = editor.getHTML();
    const res = await fetch(`/api/pages/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: html }),
    });
    if (res.ok) {
      currentContent.current = html;
      isDirty.current = false;
      onSaveStatus("saved");
    }
  }, [editor, pageId, onSaveStatus]);

  useEffect(() => {
    autoSaveTimer.current = setInterval(autoSave, 30 * 1000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [autoSave]);

  // Expose manual save for external trigger
  const manualSave = useCallback(async () => {
    if (!isDirty.current || !editor || !pageId) return;
    onSaveStatus("saving");
    const html = editor.getHTML();
    const res = await fetch(`/api/pages/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: html }),
    });
    if (res.ok) {
      currentContent.current = html;
      isDirty.current = false;
      onSaveStatus("saved");
    }
  }, [editor, pageId, onSaveStatus]);

  // Link handler
  function handleSetLink() {
    if (!editor) return;
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }

  // Current heading label
  function getHeadingLabel() {
    if (!editor) return "P";
    for (let i = 1; i <= 4; i++) {
      if (editor.isActive("heading", { level: i })) return `H${i}`;
    }
    return "P";
  }

  // Upload image and insert into editor
  async function uploadAndInsertImage(file: File) {
    if (!editor || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        editor.chain().focus().setImage({ src: url }).run();
        isDirty.current = true;
        onSaveStatus("dirty");
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao fazer upload da imagem");
      }
    } catch {
      alert("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  }

  function handleImageButtonClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadAndInsertImage(file);
      e.target.value = "";
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Toolbar */}
      <div className="editor-toolbar flex items-center px-3 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          {/* Undo / Redo */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            title="Desfazer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            title="Refazer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          </ToolbarBtn>

          <Divider />

          {/* Heading dropdown */}
          <div className="relative">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setShowHeadingMenu(!showHeadingMenu);
              }}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
                editor?.isActive("heading")
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
              }`}
              title="Tipo de bloco"
            >
              {getHeadingLabel()}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {showHeadingMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-lg">
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor
                        ?.chain()
                        .focus()
                        .toggleHeading({ level: level as 1 | 2 | 3 | 4 })
                        .run();
                      setShowHeadingMenu(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-neutral-700 ${
                      editor?.isActive("heading", { level })
                        ? "text-neutral-100"
                        : "text-neutral-400"
                    }`}
                  >
                    <span className="w-5 text-neutral-600">H{level}</span>
                    <span style={{ fontSize: `${1.1 - level * 0.1}rem`, fontWeight: 600 }}>
                      Heading {level}
                    </span>
                  </button>
                ))}
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor?.chain().focus().setParagraph().run();
                    setShowHeadingMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-neutral-700 ${
                    !editor?.isActive("heading")
                      ? "text-neutral-100"
                      : "text-neutral-400"
                  }`}
                >
                  <span className="w-5 text-neutral-600">P</span>
                  <span>Parágrafo</span>
                </button>
              </div>
            )}
          </div>

          <Divider />

          {/* Lists */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive("bulletList")}
            title="Lista"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleOrderedList().run()}
            active={editor?.isActive("orderedList")}
            title="Lista numerada"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><text x="1" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><text x="1" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><text x="1" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleTaskList().run()}
            active={editor?.isActive("taskList")}
            title="Checklist"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="6" height="6" rx="1" /><polyline points="4 11.5 6 13.5 9 8.5" /><line x1="13" y1="8" x2="21" y2="8" /><rect x="3" y="14" width="6" height="6" rx="1" /><line x1="13" y1="17" x2="21" y2="17" /></svg>
          </ToolbarBtn>

          {/* Blockquote */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleBlockquote().run()}
            active={editor?.isActive("blockquote")}
            title="Citação"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" /></svg>
          </ToolbarBtn>

          <Divider />

          {/* Inline formatting */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive("bold")}
            title="Negrito (Ctrl+B)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive("italic")}
            title="Itálico (Ctrl+I)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleUnderline().run()}
            active={editor?.isActive("underline")}
            title="Sublinhado (Ctrl+U)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleStrike().run()}
            active={editor?.isActive("strike")}
            title="Tachado"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12" /><path d="M17.5 7.5c0-2-1.5-3.5-5.5-3.5S6 5.5 6 7.5c0 1.5 1 2.5 3 3.5" /><path d="M8.5 16.5c0 2 1.5 3.5 5.5 3.5s5.5-1.5 5.5-3.5c0-1.5-1-2.5-3-3.5" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleCode().run()}
            active={editor?.isActive("code")}
            title="Código inline"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleHighlight().run()}
            active={editor?.isActive("highlight")}
            title="Destacar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /><rect x="2" y="20" width="8" height="2" rx="1" fill="currentColor" opacity="0.3" /></svg>
          </ToolbarBtn>

          {/* Link */}
          <div className="relative">
            <ToolbarBtn
              onAction={() => {
                if (editor?.isActive("link")) {
                  editor.chain().focus().unsetLink().run();
                } else {
                  const previousUrl = editor?.getAttributes("link").href || "";
                  setLinkUrl(previousUrl);
                  setShowLinkInput(true);
                }
              }}
              active={editor?.isActive("link")}
              title="Link (Ctrl+K)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            </ToolbarBtn>
            {showLinkInput && (
              <div className="absolute left-0 top-full z-50 mt-1 flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 p-2 shadow-lg">
                <input
                  type="url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSetLink();
                    if (e.key === "Escape") setShowLinkInput(false);
                  }}
                  className="w-52 rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-200 outline-none ring-1 ring-neutral-600 focus:ring-neutral-500"
                  autoFocus
                />
                <button
                  onClick={handleSetLink}
                  className="rounded bg-neutral-600 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-500"
                >
                  OK
                </button>
                <button
                  onClick={() => setShowLinkInput(false)}
                  className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:text-neutral-300"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <Divider />

          {/* Superscript / Subscript */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleSuperscript().run()}
            active={editor?.isActive("superscript")}
            title="Sobrescrito"
          >
            <span className="text-[11px]">
              x<sup className="text-[8px]">2</sup>
            </span>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleSubscript().run()}
            active={editor?.isActive("subscript")}
            title="Subscrito"
          >
            <span className="text-[11px]">
              x<sub className="text-[8px]">2</sub>
            </span>
          </ToolbarBtn>

          <Divider />

          {/* Text alignment */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().setTextAlign("left").run()}
            active={editor?.isActive({ textAlign: "left" })}
            title="Alinhar à esquerda"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().setTextAlign("center").run()}
            active={editor?.isActive({ textAlign: "center" })}
            title="Centralizar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().setTextAlign("right").run()}
            active={editor?.isActive({ textAlign: "right" })}
            title="Alinhar à direita"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
          </ToolbarBtn>
          <ToolbarBtn
            onAction={() => editor?.chain().focus().setTextAlign("justify").run()}
            active={editor?.isActive({ textAlign: "justify" })}
            title="Justificar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </ToolbarBtn>

          <Divider />

          {/* Code block */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().toggleCodeBlock().run()}
            active={editor?.isActive("codeBlock")}
            title="Bloco de código"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="14" y1="4" x2="10" y2="20" /></svg>
          </ToolbarBtn>

          {/* Horizontal rule */}
          <ToolbarBtn
            onAction={() => editor?.chain().focus().setHorizontalRule().run()}
            title="Linha horizontal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /></svg>
          </ToolbarBtn>

          {/* Image upload */}
          <ToolbarBtn
            onAction={handleImageButtonClick}
            disabled={uploading}
            title="Inserir imagem"
          >
            {uploading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            )}
          </ToolbarBtn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Sync button */}
        <button
          disabled={saveStatus !== "dirty"}
          onClick={() => manualSave()}
          className={`sync-btn ${
            saveStatus === "dirty" ? "sync-btn--dirty" : saveStatus === "saving" ? "sync-btn--saving" : ""
          }`}
        >
          {saveStatus === "saving" ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
              Sincronizando...
            </>
          ) : saveStatus === "dirty" ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
              Sincronizar
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Sincronizado
            </>
          )}
        </button>
      </div>

      {/* Editor */}
      <div
        className="editor-scroll flex-1 overflow-y-auto"
        onClick={() => {
          setShowHeadingMenu(false);
          setShowLinkInput(false);
        }}
      >
        {editor && <EditorContent editor={editor} />}
      </div>

    </div>
  );
}

/* ─── Toolbar Helpers ─── */

function Divider() {
  return <div className="mx-1 h-5 w-px bg-neutral-700" />;
}

function ToolbarBtn({
  onAction,
  active,
  disabled,
  title,
  children,
}: {
  onAction: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onAction();
      }}
      title={title}
      disabled={disabled}
      className={`flex items-center justify-center rounded p-1.5 transition ${
        disabled
          ? "cursor-not-allowed text-neutral-700"
          : active
          ? "bg-neutral-700 text-neutral-100"
          : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}
