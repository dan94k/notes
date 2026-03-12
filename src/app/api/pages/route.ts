import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const notebookId = searchParams.get("notebook_id");

  if (!notebookId) {
    return NextResponse.json({ error: "notebook_id é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pages")
    .select("id, notebook_id, title, created_at, updated_at")
    .eq("notebook_id", notebookId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { notebook_id, title } = await request.json();

  if (!notebook_id || !title?.trim()) {
    return NextResponse.json({ error: "notebook_id e title são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pages")
    .insert({ notebook_id, title: title.trim(), content: "" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
