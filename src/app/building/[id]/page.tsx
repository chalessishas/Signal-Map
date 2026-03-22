import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getBuildingEventsWindow } from "@/lib/events";
import { CommentSection } from "@/components/comment-section";

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) notFound();

  const { nowEvents, upcomingEvents } = await getBuildingEventsWindow(id);

  const pastEvents = await prisma.event.findMany({
    where: {
      buildingId: id,
      status: "ACTIVE",
      endTime: { lt: new Date() },
    },
    orderBy: { startTime: "desc" },
    take: 20,
  });

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px", fontFamily: "var(--font-body)" }}>
      <Link href="/" className="view-all-link" style={{ display: "inline-block", padding: "6px 0", marginBottom: 16 }}>
        &larr; Back to Map
      </Link>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>
            {building.name}
          </h1>
          <span className="badge badge-campus">
            {building.campus === "NORTH" ? "North" : building.campus === "SOUTH" ? "South" : "Campus"}
          </span>
        </div>
      </div>

      <div className="overlay-stats" style={{ maxWidth: 320, marginBottom: 24 }}>
        <div className="overlay-stat">
          <span className="overlay-stat-num">{nowEvents.length}</span>
          <span className="overlay-stat-label">Now</span>
        </div>
        <div className="overlay-stat">
          <span className="overlay-stat-num">{upcomingEvents.length}</span>
          <span className="overlay-stat-label">Upcoming</span>
        </div>
      </div>

      {nowEvents.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--ink-faint)", marginBottom: 12 }}>
            Happening Now
          </h2>
          <div className="event-list">
            {nowEvents.map((event) => (
              <article className="event-card event-card--live" key={event.id}>
                <div className="event-card-top">
                  <span className="live-dot" />
                  <strong>{event.title}</strong>
                </div>
                <div className="event-card-meta">
                  {format(event.startTime, "MMM d, h:mm a")}
                  {event.endTime && ` – ${format(event.endTime, "h:mm a")}`}
                </div>
                {event.locationText && <div className="event-card-loc">{event.locationText}</div>}
                {event.description && (
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>
                    {event.description.slice(0, 250)}
                    {event.description.length > 250 ? "..." : ""}
                  </p>
                )}
                {event.category && <span className="badge badge-sm">{event.category}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--ink-faint)", marginBottom: 12 }}>
          Next 3 Days
        </h2>
        <div className="event-list">
          {upcomingEvents.length === 0 ? (
            <p className="subtle">No upcoming events</p>
          ) : (
            upcomingEvents.map((event) => (
              <article className="event-card" key={event.id}>
                <div className="event-card-top">
                  <strong>{event.title}</strong>
                </div>
                <div className="event-card-meta">
                  {format(event.startTime, "EEE MMM d, h:mm a")}
                  {event.endTime && ` – ${format(event.endTime, "h:mm a")}`}
                </div>
                {event.locationText && <div className="event-card-loc">{event.locationText}</div>}
                {event.description && (
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>
                    {event.description.slice(0, 250)}
                    {event.description.length > 250 ? "..." : ""}
                  </p>
                )}
                {event.category && <span className="badge badge-sm">{event.category}</span>}
              </article>
            ))
          )}
        </div>
      </section>

      {pastEvents.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--ink-faint)", marginBottom: 12 }}>
            Past Events
          </h2>
          <div className="event-list">
            {pastEvents.map((event) => (
              <article className="event-card event-card--past" key={event.id}>
                <div className="event-card-top">
                  <strong>{event.title}</strong>
                </div>
                <div className="event-card-meta">
                  {format(event.startTime, "EEE MMM d, h:mm a")}
                  {event.endTime && ` – ${format(event.endTime, "h:mm a")}`}
                </div>
                {event.locationText && <div className="event-card-loc">{event.locationText}</div>}
                {event.description && (
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>
                    {event.description.slice(0, 250)}
                    {event.description.length > 250 ? "..." : ""}
                  </p>
                )}
                {event.category && <span className="badge badge-sm">{event.category}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      <CommentSection buildingId={id} />
    </main>
  );
}
