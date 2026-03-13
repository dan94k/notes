"use client";

import { useState, useEffect, useCallback } from "react";
import PasswordModal from "@/components/PasswordModal";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "dirty">(
    "saved"
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

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

  const handleSelectPage = useCallback(
    (id: string) => {
      setSelectedPage(id || null);
      if (isMobile) setMobileSidebarOpen(false);
    },
    [isMobile]
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
          onSelectPage={handleSelectPage}
          onLogout={handleLogout}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          isMobile={isMobile}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <main className="sidebar-panel flex flex-1 flex-col overflow-hidden">
          {selectedPage ? (
            <Editor
              pageId={selectedPage}
              saveStatus={saveStatus}
              onSaveStatus={handleSaveStatus}
              isMobile={isMobile}
              onOpenSidebar={() => setMobileSidebarOpen(true)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <p className="text-sm text-neutral-600">
                {selectedNotebook
                  ? "Selecione ou crie uma página"
                  : "Selecione ou crie um caderno"}
              </p>
              {isMobile && !mobileSidebarOpen && (
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-300"
                >
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="1.5" width="9" height="11" rx="1.5" />
                    <path d="M5 1.5v11" />
                    <path d="M7.5 5.5L9.5 7 7.5 8.5" />
                  </svg>
                  Abrir cadernos
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
