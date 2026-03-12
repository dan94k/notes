"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ConfirmDialog from "./ConfirmDialog";

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
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {collapsed ? (
        <>
          <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
          <path d="M5 1.5v11" />
          <path d="M7.5 5.5L9.5 7 7.5 8.5" />
        </>
      ) : (
        <>
          <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
          <path d="M5 1.5v11" />
          <path d="M9.5 5.5L7.5 7 9.5 8.5" />
        </>
      )}
    </svg>
  );
}

/* ── Inline SVG icons (14×14, stroke-based) ── */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-transform duration-200"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}

function NotebookIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="2.5" y="1.5" width="9" height="11" rx="1.5" />
      <path d="M5 1.5v11" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 opacity-50"
    >
      <path d="M8 1.5H4a1.5 1.5 0 00-1.5 1.5v8A1.5 1.5 0 004 12.5h6a1.5 1.5 0 001.5-1.5V5L8 1.5z" />
      <path d="M8 1.5V5h3.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2.5l2 2L5 11H3v-2l6.5-6.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4h9M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3.5 4l.5 7.5a1 1 0 001 .5h4a1 1 0 001-.5L10.5 4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M7 3v8M3 7h8" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5H3a1 1 0 01-1-1v-9a1 1 0 011-1h2M9.5 10l3-3-3-3M12.5 7H5" />
    </svg>
  );
}

/* ── Sidebar component ── */

export default function Sidebar({
  selectedNotebook,
  selectedPage,
  onSelectNotebook,
  onSelectPage,
  onLogout,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [pagesMap, setPagesMap] = useState<Record<string, Page[]>>({});
  const [loadingPages, setLoadingPages] = useState<Record<string, boolean>>({});
  const [editingNotebook, setEditingNotebook] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "notebook" | "page";
    id: string;
    notebookId?: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    fetchNotebooks();
  }, []);

  // Fetch pages when a notebook is selected (expanded)
  const fetchPagesForNotebook = useCallback(async (notebookId: string) => {
    if (pagesMap[notebookId]) return; // already loaded
    setLoadingPages((prev) => ({ ...prev, [notebookId]: true }));
    const res = await fetch(`/api/pages?notebook_id=${notebookId}`);
    if (res.ok) {
      const pages = await res.json();
      setPagesMap((prev) => ({ ...prev, [notebookId]: pages }));
    }
    setLoadingPages((prev) => ({ ...prev, [notebookId]: false }));
  }, [pagesMap]);

  useEffect(() => {
    if (selectedNotebook) {
      fetchPagesForNotebook(selectedNotebook);
    }
  }, [selectedNotebook, fetchPagesForNotebook]);

  useEffect(() => {
    if (editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingNotebook, editingPage]);

  async function fetchNotebooks() {
    const res = await fetch("/api/notebooks");
    if (res.ok) setNotebooks(await res.json());
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
      setPagesMap((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      if (selectedNotebook === id) {
        onSelectNotebook("");
        onSelectPage("");
      }
    }
  }

  async function createPage(notebookId: string) {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notebook_id: notebookId,
        title: "Nova página",
      }),
    });
    if (res.ok) {
      const page = await res.json();
      setPagesMap((prev) => ({
        ...prev,
        [notebookId]: [page, ...(prev[notebookId] || [])],
      }));
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
      setPagesMap((prev) => {
        const updated = { ...prev };
        for (const key in updated) {
          updated[key] = updated[key].map((p) =>
            p.id === id ? { ...p, title } : p
          );
        }
        return updated;
      });
    }
    setEditingPage(null);
  }

  async function deletePage(id: string, notebookId: string) {
    const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPagesMap((prev) => ({
        ...prev,
        [notebookId]: (prev[notebookId] || []).filter((p) => p.id !== id),
      }));
      if (selectedPage === id) onSelectPage("");
    }
  }

  function handleConfirmDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.type === "notebook") {
      deleteNotebook(confirmDelete.id);
    } else {
      deletePage(confirmDelete.id, confirmDelete.notebookId!);
    }
    setConfirmDelete(null);
  }

  function handleNotebookClick(id: string) {
    if (selectedNotebook === id) {
      // collapse
      onSelectNotebook("");
      onSelectPage("");
    } else {
      onSelectNotebook(id);
    }
  }

  const pages = selectedNotebook ? pagesMap[selectedNotebook] || [] : [];
  const isLoadingCurrentPages = selectedNotebook
    ? loadingPages[selectedNotebook]
    : false;

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="sidebar-collapse-btn fixed top-[12px] left-[12px] z-50"
        title="Expandir menu"
      >
        <SidebarToggleIcon collapsed />
      </button>
    );
  }

  return (
    <aside className="sidebar-panel flex w-64 flex-col shrink-0 overflow-hidden sidebar-animate">
      {/* Header */}
      <div className="sidebar-header flex items-center justify-between px-4 py-3">
        <span className="sidebar-title text-sm font-semibold tracking-tight">
          Notes
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onToggleCollapse}
            className="sidebar-action-btn"
            title="Colapsar menu"
          >
            <SidebarToggleIcon collapsed={false} />
          </button>
          <button
            onClick={onLogout}
            className="sidebar-action-btn"
            title="Sair"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

      {/* Section label + new notebook */}
      <div className="flex items-center justify-between px-4 pt-1 pb-2">
        <span className="sidebar-section-label">Cadernos</span>
        <button
          onClick={createNotebook}
          className="sidebar-action-btn"
          title="Novo caderno"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Notebook list */}
      <div className="sidebar-scroll flex-1 overflow-y-auto px-2 pb-3">
        {notebooks.length === 0 && (
          <p className="sidebar-empty px-2 py-4 text-center text-xs">
            Nenhum caderno ainda
          </p>
        )}

        {notebooks.map((nb) => {
          const isOpen = selectedNotebook === nb.id;
          const nbPages = pagesMap[nb.id] || [];
          const isLoading = loadingPages[nb.id];

          return (
            <div key={nb.id} className="mb-0.5">
              {/* Notebook row */}
              <div
                className={`sidebar-notebook-row group ${isOpen ? "is-open" : ""}`}
              >
                {editingNotebook === nb.id ? (
                  <div className="flex flex-1 items-center gap-2 px-2 py-1.5">
                    <NotebookIcon />
                    <input
                      ref={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => renameNotebook(nb.id, editValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameNotebook(nb.id, editValue);
                        if (e.key === "Escape") setEditingNotebook(null);
                      }}
                      className="sidebar-inline-input flex-1"
                    />
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleNotebookClick(nb.id)}
                      className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left"
                    >
                      <ChevronIcon open={isOpen} />
                      <NotebookIcon />
                      <span className="flex-1 truncate text-[13px]">
                        {nb.name}
                      </span>
                    </button>
                    <div className="sidebar-row-actions opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNotebook(nb.id);
                          setEditValue(nb.name);
                        }}
                        className="sidebar-icon-btn"
                        title="Renomear"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete({ type: "notebook", id: nb.id, name: nb.name });
                        }}
                        className="sidebar-icon-btn sidebar-icon-btn--danger"
                        title="Deletar"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Expanded pages */}
              {isOpen && (
                <div className="sidebar-pages-list">
                  {isLoading ? (
                    <p className="sidebar-empty py-2 text-center text-xs">
                      Carregando...
                    </p>
                  ) : (
                    <>
                      {nbPages.map((page) => (
                        <div
                          key={page.id}
                          className={`sidebar-page-row group ${
                            selectedPage === page.id ? "is-active" : ""
                          }`}
                        >
                          {editingPage === page.id ? (
                            <div className="flex flex-1 items-center gap-2 py-1 pl-2">
                              <PageIcon />
                              <input
                                ref={editRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => renamePage(page.id, editValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    renamePage(page.id, editValue);
                                  if (e.key === "Escape")
                                    setEditingPage(null);
                                }}
                                className="sidebar-inline-input flex-1"
                              />
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => onSelectPage(page.id)}
                                className="flex flex-1 items-center gap-2 py-1 pl-2 text-left"
                              >
                                <PageIcon />
                                <span className="flex-1 truncate text-[12px]">
                                  {page.title}
                                </span>
                              </button>
                              <div className="sidebar-row-actions opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingPage(page.id);
                                    setEditValue(page.title);
                                  }}
                                  className="sidebar-icon-btn"
                                  title="Renomear"
                                >
                                  <PencilIcon />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDelete({ type: "page", id: page.id, notebookId: nb.id, name: page.title });
                                  }}
                                  className="sidebar-icon-btn sidebar-icon-btn--danger"
                                  title="Deletar"
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* New page button */}
                      <button
                        onClick={() => createPage(nb.id)}
                        className="sidebar-new-page"
                      >
                        <PlusIcon />
                        <span>Nova página</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={
          confirmDelete?.type === "notebook"
            ? "Excluir caderno"
            : "Excluir página"
        }
        message={
          confirmDelete?.type === "notebook"
            ? `Tem certeza que deseja excluir "${confirmDelete?.name}"? Todas as páginas dentro dele serão perdidas.`
            : `Tem certeza que deseja excluir "${confirmDelete?.name}"?`
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </aside>
  );
}
