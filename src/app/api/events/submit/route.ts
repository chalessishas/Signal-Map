import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

const submitSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional(),
  buildingId: z.string().optional(),
  locationText: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.userProfile.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    },
  });

  const event = await prisma.userEvent.create({
    data: {
      ...parsed.data,
      authorId: user.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
