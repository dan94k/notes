"use client";

import { useState, FormEvent, useRef, useEffect } from "react";

export default function PasswordModal({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    <div className="password-overlay">
      <form
        onSubmit={handleSubmit}
        className="confirm-dialog flex flex-col gap-4"
      >
        <h3 className="confirm-title text-center text-base">Notes</h3>
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Digite sua senha"
          className="password-input"
        />
        {error && <p className="password-error">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="password-btn-submit"
        >
          {loading ? "..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
