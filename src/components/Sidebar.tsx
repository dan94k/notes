"use client";

import { useState, useEffect, useRef } from "react";

interface Notebook {
  id: string;
  name: string;
  created_at: string;
}

interface Page {
  id: string;
  notebook_id: string;
  title: string;
  updated_at: string;
}

interface SidebarProps {
  selectedNotebook: string | null;
  selectedPage: string | null;
  onSelectNotebook: (id: string) => void;
  onSelectPage: (id: string) => void;
  onLogout: () => void;
}

export default function Sidebar({
  selectedNotebook,
  selectedPage,
  onSelectNotebook,
  onSelectPage,
  onLogout,
}: SidebarProps) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [editingNotebook, setEditingNotebook] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotebooks();
  }, []);

  useEffect(() => {
    if (selectedNotebook) fetchPages(selectedNotebook);
    else setPages([]);
  }, [selectedNotebook]);

  useEffect(() => {
    if (editRef.current) editRef.current.focus();
  }, [editingNotebook, editingPage]);

  async function fetchNotebooks() {
    const res = await fetch("/api/notebooks");
    if (res.ok) setNotebooks(await res.json());
  }

  async function fetchPages(notebookId: string) {
    const res = await fetch(`/api/pages?notebook_id=${notebookId}`);
    if (res.ok) setPages(await res.json());
  }

  async function createNotebook() {
    const res = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Novo caderno" }),
    });
    if (res.ok) {
      const nb = await res.json();
      setNotebooks((prev) => [...prev, nb]);
      setEditingNotebook(nb.id);
      setEditValue(nb.name);
      onSelectNotebook(nb.id);
    }
  }

  async function renameNotebook(id: string, name: string) {
    if (!name.trim()) return;
    const res = await fetch("/api/notebooks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (res.ok) {
      setNotebooks((prev) =>
        prev.map((nb) => (nb.id === id ? { ...nb, name } : nb))
      );
    }
    setEditingNotebook(null);
  }

  async function deleteNotebook(id: string) {
    const res = await fetch("/api/notebooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
      if (selectedNotebook === id) {
        onSelectNotebook("");
        onSelectPage("");
      }
    }
  }

  async function createPage() {
    if (!selectedNotebook) return;
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notebook_id: selectedNotebook,
        title: "Nova página",
      }),
    });
    if (res.ok) {
      const page = await res.json();
      setPages((prev) => [page, ...prev]);
      setEditingPage(page.id);
      setEditValue(page.title);
      onSelectPage(page.id);
    }
  }

  async function renamePage(id: string, title: string) {
    if (!title.trim()) return;
    const res = await fetch(`/api/pages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, title } : p))
      );
    }
    setEditingPage(null);
  }

  async function deletePage(id: string) {
    const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPages((prev) => prev.filter((p) => p.id !== id));
      if (selectedPage === id) onSelectPage("");
    }
  }

  return (
    <aside className="sidebar-panel flex w-64 flex-col my-[15px] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-neutral-300">Notes</span>
        <button
          onClick={onLogout}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Sair
        </button>
      </div>

      {/* Notebooks */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Cadernos
        </span>
        <button
          onClick={createNotebook}
          className="text-lg leading-none text-neutral-500 hover:text-neutral-300"
          title="Novo caderno"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notebooks.map((nb) => (
          <div
            key={nb.id}
            className={`group flex items-center gap-1 px-3 py-1.5 ${
              selectedNotebook === nb.id
                ? "bg-neutral-800/60 text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
            }`}
          >
            {editingNotebook === nb.id ? (
              <input
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => renameNotebook(nb.id, editValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameNotebook(nb.id, editValue);
                  if (e.key === "Escape") setEditingNotebook(null);
                }}
                className="flex-1 bg-transparent text-sm outline-none"
              />
            ) : (
              <>
                <button
                  onClick={() => onSelectNotebook(nb.id)}
                  className="flex-1 truncate text-left text-sm"
                >
                  {nb.name}
                </button>
                <button
                  onClick={() => {
                    setEditingNotebook(nb.id);
                    setEditValue(nb.name);
                  }}
                  className="hidden text-xs text-neutral-500 hover:text-neutral-300 group-hover:block"
                  title="Renomear"
                >
                  ✎
                </button>
                <button
                  onClick={() => deleteNotebook(nb.id)}
                  className="hidden text-xs text-neutral-500 hover:text-red-400 group-hover:block"
                  title="Deletar"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}

        {/* Pages */}
        {selectedNotebook && (
          <>
            <div className="mt-4 flex items-center justify-between px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Páginas
              </span>
              <button
                onClick={createPage}
                className="text-lg leading-none text-neutral-500 hover:text-neutral-300"
                title="Nova página"
              >
                +
              </button>
            </div>

            {pages.map((page) => (
              <div
                key={page.id}
                className={`group flex items-center gap-1 px-3 py-1.5 pl-6 ${
                  selectedPage === page.id
                    ? "bg-neutral-800/60 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                {editingPage === page.id ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => renamePage(page.id, editValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renamePage(page.id, editValue);
                      if (e.key === "Escape") setEditingPage(null);
                    }}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => onSelectPage(page.id)}
                      className="flex-1 truncate text-left text-sm"
                    >
                      {page.title}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPage(page.id);
                        setEditValue(page.title);
                      }}
                      className="hidden text-xs text-neutral-500 hover:text-neutral-300 group-hover:block"
                      title="Renomear"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => deletePage(page.id)}
                      className="hidden text-xs text-neutral-500 hover:text-red-400 group-hover:block"
                      title="Deletar"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
