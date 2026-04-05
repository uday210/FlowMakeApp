import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

const BUCKET = "form-uploads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBucket(admin: SupabaseClient<any>) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: true });
  }
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify form exists and is published
  const { data: form, error: formErr } = await admin
    .from("forms")
    .select("id")
    .eq("id", id)
    .eq("is_published", true)
    .single();
  if (formErr || !form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate size (10 MB cap)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  await ensureBucket(admin);

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${id}/${crypto.randomUUID()}/${safeName}`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, name: file.name, size: file.size });
}
