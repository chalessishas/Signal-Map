import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      lat: true,
      lng: true,
      campus: true,
      aliases: true
    },
    orderBy: { name: "asc" }
  });

  const buildings = rows.map((b) => {
    let aliases: string[] = [];
    try {
      const parsed = JSON.parse(b.aliases);
      if (Array.isArray(parsed)) aliases = parsed;
    } catch {
      // malformed JSON — fall back to empty array
    }
    return { ...b, aliases };
  });

  return NextResponse.json({ items: buildings });
}
