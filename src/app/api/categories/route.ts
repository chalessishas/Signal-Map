import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.event.findMany({
    where: {
      status: "ACTIVE",
      category: { not: null },
    },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  const items = rows
    .map((r) => r.category)
    .filter((c): c is string => c !== null);

  return NextResponse.json({ items });
}
