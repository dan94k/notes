import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.NOTES_PASSWORD) {
    return NextResponse.json({ error: "Senha inválida" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
