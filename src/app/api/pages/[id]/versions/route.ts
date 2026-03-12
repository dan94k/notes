import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("page_versions")
    .select("*")
    .eq("page_id", id)
    .order("saved_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { content } = await request.json();

  // Save the snapshot
  const { error: insertError } = await supabase
    .from("page_versions")
    .insert({ page_id: id, content });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Cleanup: keep only latest 10 versions per page
  const { data: versions } = await supabase
    .from("page_versions")
    .select("id, saved_at")
    .eq("page_id", id)
    .order("saved_at", { ascending: false });

  if (versions && versions.length > 10) {
    const toDelete = versions.slice(10).map((v) => v.id);
    await supabase.from("page_versions").delete().in("id", toDelete);
  }

  // Also cleanup versions older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("page_versions")
    .delete()
    .eq("page_id", id)
    .lt("saved_at", thirtyDaysAgo);

  return NextResponse.json({ ok: true }, { status: 201 });
}
