"use client";

import { useState } from "react";
import type { BuildingSummary } from "@/lib/types";

const CATEGORIES = [
  "Academic", "Social", "Arts", "Performance",
  "Fitness", "Career", "Athletics", "Library", "Other",
];

type Props = {
  buildings: BuildingSummary[];
  onClose: () => void;
};

export function SubmitEventForm({ buildings, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      title: form.get("title"),
      description: form.get("description") || undefined,
      startTime: form.get("startTime"),
      endTime: form.get("endTime") || undefined,
      buildingId: form.get("buildingId") || undefined,
      locationText: form.get("locationText") || undefined,
      category: form.get("category") || undefined,
    };

    try {
      const res = await fetch("/api/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.formErrors?.[0] ?? "Submission failed");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="submit-event-overlay">
        <div className="submit-event-form">
          <div className="submit-success">
            <h3>Event Submitted!</h3>
            <p>Your event is pending review. It will appear on the map once approved.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-event-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="submit-event-form" onSubmit={handleSubmit}>
        <div className="submit-form-header">
          <h3>Submit an Event</h3>
          <button type="button" className="overlay-close" onClick={onClose}>&times;</button>
        </div>

        {error && <p className="submit-error">{error}</p>}

        <label className="submit-field">
          <span>Title *</span>
          <input name="title" required minLength={3} maxLength={200} placeholder="Event name" />
        </label>

        <label className="submit-field">
          <span>Description</span>
          <textarea name="description" maxLength={2000} rows={3} placeholder="What's this event about?" />
        </label>

        <div className="submit-row">
          <label className="submit-field">
            <span>Start *</span>
            <input name="startTime" type="datetime-local" required />
          </label>
          <label className="submit-field">
            <span>End</span>
            <input name="endTime" type="datetime-local" />
          </label>
        </div>

        <label className="submit-field">
          <span>Building</span>
          <select name="buildingId">
            <option value="">Select a building...</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>

        <label className="submit-field">
          <span>Or type a location</span>
          <input name="locationText" maxLength={200} placeholder="e.g. The Pit, South Campus" />
        </label>

        <label className="submit-field">
          <span>Category</span>
          <select name="category">
            <option value="">Select...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Event"}
        </button>
      </form>
    </div>
  );
}
