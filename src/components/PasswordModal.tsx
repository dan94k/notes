"use client";

import { useState, FormEvent } from "react";

export default function PasswordModal({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      onSuccess();
    } else {
      setError("Senha inválida");
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="flex w-80 flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8"
      >
        <h1 className="text-center text-lg font-semibold text-neutral-100">
          Notes
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          autoFocus
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-neutral-500"
        />
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          {loading ? "..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
