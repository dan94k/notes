"use client";

import { useState, useEffect, useCallback } from "react";
import PasswordModal from "@/components/PasswordModal";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "dirty">(
    "saved"
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const res = await fetch("/api/auth/check");
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(data.authenticated);
      } else {
        setAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  }

  const handleSaveStatus = useCallback(
    (status: "saved" | "saving" | "dirty") => {
      setSaveStatus(status);
    },
    []
  );

  // Loading state
  if (authenticated === null) {
    return (
      <div className="flex h-screen flex-col items-center">
        <div className="w-full max-w-[1280px]">
          {/* @ts-expect-error -- web component */}
          <bydan-header></bydan-header>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-neutral-500">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center text-neutral-100">
      <div className="w-full max-w-[1280px]">
        {/* @ts-expect-error -- web component */}
        <bydan-header></bydan-header>
      </div>
      <div className="relative flex w-full max-w-[1280px] flex-1 gap-[15px] overflow-hidden">
      {!authenticated && authenticated !== null && (
        <PasswordModal onSuccess={() => setAuthenticated(true)} />
      )}
      <Sidebar
        authenticated={authenticated}
        selectedNotebook={selectedNotebook}
        selectedPage={selectedPage}
        onSelectNotebook={(id) => {
          setSelectedNotebook(id || null);
          setSelectedPage(null);
        }}
        onSelectPage={(id) => setSelectedPage(id || null)}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <main className="sidebar-panel flex flex-1 flex-col overflow-hidden">
        {selectedPage ? (
          <>
            <Editor pageId={selectedPage} onSaveStatus={handleSaveStatus} />
            <div className="editor-statusbar px-4 py-1.5 text-right">
              <span
                className={`text-xs ${
                  saveStatus === "saved"
                    ? "text-neutral-600"
                    : saveStatus === "saving"
                    ? "text-yellow-600"
                    : "text-orange-500"
                }`}
              >
                {saveStatus === "saved"
                  ? "Salvo"
                  : saveStatus === "saving"
                  ? "Salvando..."
                  : "Alterações não salvas"}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-neutral-600">
              {selectedNotebook
                ? "Selecione ou crie uma página"
                : "Selecione ou crie um caderno"}
            </p>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
