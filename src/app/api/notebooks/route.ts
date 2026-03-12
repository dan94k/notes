import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("notebooks")
    .select("*, pages:pages(count)")
    .is("deleted_at", null)
    .is("pages.deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten page count from Supabase aggregate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data ?? []).map((nb: any) => ({
    ...nb,
    page_count: nb.pages?.[0]?.count ?? 0,
    pages: undefined,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { name } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notebooks")
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { id, name } = await request.json();

  if (!id || !name?.trim()) {
    return NextResponse.json({ error: "ID e nome são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notebooks")
    .update({ name: name.trim() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();

  const { error } = await supabase
    .from("notebooks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
