"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export function RsvpForm({
  initialMealPreference,
  initialMessage,
  initialPartySize,
  initialStatus,
  inviteeName,
  rsvpDeadline,
  slug,
}: {
  initialMealPreference?: string | null;
  initialMessage?: string | null;
  initialPartySize?: number | null;
  initialStatus?: "PENDING" | "ATTENDING" | "DECLINED";
  inviteeName: string;
  rsvpDeadline?: string | null;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(initialStatus ?? "PENDING");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialStatus !== "PENDING");
  const [error, setError] = useState("");
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDeadlinePassed(
        Boolean(
          rsvpDeadline &&
          new Date(rsvpDeadline).getTime() < new Date().getTime(),
        ),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [rsvpDeadline]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/events/public/${slug}/rsvp`, {
        method: "POST",
        body: JSON.stringify({
          status,
          partySize:
            status === "ATTENDING"
              ? Number(form.get("partySize") || 1)
              : undefined,
          mealPreference:
            status === "ATTENDING"
              ? String(form.get("mealPreference") || "")
              : undefined,
          message: String(form.get("message") || ""),
        }),
      });
      setSaved(true);
      setOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save RSVP.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] max-w-[calc(100vw-2.5rem)]"
      id="nimto-rsvp-form"
    >
      {open ? (
        <form
          className="mb-3 w-[min(390px,calc(100vw-2.5rem))] rounded-2xl border border-black/10 bg-white p-5 text-left shadow-2xl"
          onSubmit={submit}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">
                RSVP for {inviteeName}
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                Will you join us?
              </h2>
            </div>
            <button
              aria-label="Close RSVP form"
              className="text-xl text-slate-500"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          {rsvpDeadline ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              Please respond by{" "}
              {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                new Date(rsvpDeadline),
              )}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["ATTENDING", "DECLINED"] as const).map((option) => (
              <button
                className={
                  status === option
                    ? "rounded-xl bg-emerald-700 px-3 py-3 font-bold text-white"
                    : "rounded-xl border border-slate-200 px-3 py-3 font-bold text-slate-700"
                }
                key={option}
                onClick={() => setStatus(option)}
                type="button"
              >
                {option === "ATTENDING" ? "Attending" : "Cannot attend"}
              </button>
            ))}
          </div>
          {status === "ATTENDING" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                Party size
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  defaultValue={initialPartySize ?? 1}
                  max={20}
                  min={1}
                  name="partySize"
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                Meal preference
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  defaultValue={initialMealPreference ?? ""}
                  name="mealPreference"
                  placeholder="Optional"
                />
              </label>
            </div>
          ) : null}
          <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
            Message
            <textarea
              className="rounded-lg border border-slate-200 px-3 py-2"
              defaultValue={initialMessage ?? ""}
              name="message"
              placeholder="Optional note for the host"
              rows={3}
            />
          </label>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <button
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white"
            disabled={saving || status === "PENDING"}
            type="submit"
          >
            {saving ? "Saving..." : "Save RSVP"}
          </button>
        </form>
      ) : null}
      <button
        className="ml-auto block rounded-full bg-emerald-700 px-5 py-3 font-black text-white shadow-xl"
        disabled={deadlinePassed}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {deadlinePassed ? "RSVP closed" : saved ? "RSVP saved ✓" : "RSVP"}
      </button>
    </div>
  );
}
