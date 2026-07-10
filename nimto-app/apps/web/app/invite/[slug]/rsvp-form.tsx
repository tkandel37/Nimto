"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { RsvpConfig, RsvpFieldConfig } from "../../events/event-types";

type RsvpStatus = "PENDING" | "ATTENDING" | "DECLINED";

export function RsvpForm({
  config,
  initialMealPreference,
  initialMessage,
  initialPartySize,
  initialStatus,
  inviteeName,
  publicMode = false,
  rsvpDeadline,
  slug,
}: {
  config: RsvpConfig;
  initialMealPreference?: string | null;
  initialMessage?: string | null;
  initialPartySize?: number | null;
  initialStatus?: RsvpStatus;
  inviteeName: string;
  publicMode?: boolean;
  rsvpDeadline?: string | null;
  slug: string;
}) {
  const [status, setStatus] = useState<RsvpStatus>(initialStatus ?? "PENDING");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialStatus !== "PENDING");
  const [error, setError] = useState("");
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const fields = useMemo(
    () => config.fields.filter((field) => field.enabled),
    [config.fields],
  );
  const attendanceField =
    fields.find((field) => field.key === "attendance_status") ?? null;
  const visibleFields = fields.filter(
    (field) =>
      field.key !== "attendance_status" &&
      !(status !== "ATTENDING" && isAttendanceOnlyField(field.key)),
  );

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
              ? Number(form.get("number_of_guests") || initialPartySize || 1)
              : undefined,
          mealPreference:
            status === "ATTENDING"
              ? String(
                  form.get("meal_preference") || initialMealPreference || "",
                )
              : undefined,
          message: String(form.get("message") || initialMessage || ""),
          answers: collectAnswers(form, fields, {
            initialMealPreference,
            initialMessage,
            initialPartySize,
            inviteeName,
            publicMode,
            status,
          }),
        }),
      });
      setSaved(true);
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
    <section className="nimto-rsvp-section" id="nimto-rsvp-form">
      <div className="nimto-rsvp-shell">
        <div className="nimto-rsvp-heading">
          <div>
            <p className="nimto-rsvp-kicker">
              {publicMode ? "RSVP" : `RSVP for ${inviteeName}`}
            </p>
            <h2>{attendanceField?.label ?? "Will you join us?"}</h2>
            {rsvpDeadline ? (
              <p className="nimto-rsvp-meta">
                Please respond by{" "}
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                  new Date(rsvpDeadline),
                )}
              </p>
            ) : null}
          </div>
          {saved ? (
            <span className="nimto-rsvp-saved">Response saved</span>
          ) : null}
        </div>

        {config.note ? <p className="nimto-rsvp-note">{config.note}</p> : null}
        {deadlinePassed ? (
          <div className="nimto-rsvp-closed">{config.closedMessage}</div>
        ) : null}

        {!deadlinePassed ? (
          <form className="nimto-rsvp-form" onSubmit={submit}>
            <div className="nimto-rsvp-choice-group" role="group">
              {(attendanceField?.options?.length
                ? attendanceField.options
                : ["Attending", "Cannot attend"]
              ).map((option, index) => {
                const optionStatus = index === 0 ? "ATTENDING" : "DECLINED";
                return (
                  <button
                    className={status === optionStatus ? "active" : ""}
                    key={option}
                    onClick={() => setStatus(optionStatus)}
                    type="button"
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="nimto-rsvp-fields">
              {visibleFields.map((field) =>
                renderField(field, {
                  inviteeName,
                  initialMealPreference,
                  initialMessage,
                  initialPartySize,
                  publicMode,
                }),
              )}
            </div>

            {error ? <p className="nimto-rsvp-error">{error}</p> : null}
            <button
              className="nimto-rsvp-submit"
              disabled={saving || status === "PENDING"}
              type="submit"
            >
              {saving ? "Saving..." : saved ? "Update RSVP" : "Send RSVP"}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function renderField(
  field: RsvpFieldConfig,
  context: {
    inviteeName: string;
    initialMealPreference?: string | null;
    initialMessage?: string | null;
    initialPartySize?: number | null;
    publicMode: boolean;
  },
) {
  const commonLabel = (
    <span>
      {field.label}
      {field.required ? " *" : ""}
    </span>
  );

  if (field.key === "full_name" && !context.publicMode) {
    return (
      <label className="nimto-rsvp-field" key={field.id}>
        {commonLabel}
        <input
          defaultValue={context.inviteeName}
          name={field.key}
          readOnly
          type="text"
        />
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="nimto-rsvp-field span-2" key={field.id}>
        {commonLabel}
        <textarea
          defaultValue={
            field.key === "message" ? (context.initialMessage ?? "") : ""
          }
          name={field.key}
          placeholder={field.placeholder ?? undefined}
          required={field.required}
          rows={4}
        />
      </label>
    );
  }

  if (field.type === "single_choice") {
    return (
      <label className="nimto-rsvp-field" key={field.id}>
        {commonLabel}
        <select defaultValue="" name={field.key} required={field.required}>
          <option value="">Select</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="nimto-rsvp-field" key={field.id}>
      {commonLabel}
      <input
        defaultValue={defaultFieldValue(field.key, context)}
        min={field.type === "number" ? 1 : undefined}
        name={field.key}
        placeholder={field.placeholder ?? undefined}
        required={field.required}
        type={inputType(field.type)}
      />
    </label>
  );
}

function defaultFieldValue(
  key: string,
  context: {
    inviteeName: string;
    initialMealPreference?: string | null;
    initialMessage?: string | null;
    initialPartySize?: number | null;
    publicMode: boolean;
  },
) {
  switch (key) {
    case "full_name":
      return context.publicMode ? "" : context.inviteeName;
    case "number_of_guests":
      return context.initialPartySize ?? 1;
    case "meal_preference":
      return context.initialMealPreference ?? "";
    default:
      return "";
  }
}

function collectAnswers(
  form: FormData,
  fields: RsvpFieldConfig[],
  context: {
    initialMealPreference?: string | null;
    initialMessage?: string | null;
    initialPartySize?: number | null;
    inviteeName: string;
    publicMode: boolean;
    status: RsvpStatus;
  },
) {
  const answers: Record<string, string | number> = {
    attendance_status:
      context.status === "ATTENDING" ? "Attending" : "Cannot attend",
  };
  for (const field of fields) {
    if (!field.enabled || field.key === "attendance_status") continue;
    if (context.status !== "ATTENDING" && isAttendanceOnlyField(field.key)) {
      continue;
    }
    if (field.key === "full_name" && !context.publicMode) {
      answers[field.key] = context.inviteeName;
      continue;
    }
    const raw = form.get(field.key);
    if (field.type === "number") {
      const value = Number(raw || 0);
      if (Number.isFinite(value) && value > 0) {
        answers[field.key] = value;
      }
      continue;
    }
    const value = String(raw ?? "").trim();
    if (value) answers[field.key] = value;
  }
  if (!answers.meal_preference && context.initialMealPreference) {
    answers.meal_preference = context.initialMealPreference;
  }
  if (!answers.message && context.initialMessage) {
    answers.message = context.initialMessage;
  }
  if (!answers.number_of_guests && context.initialPartySize) {
    answers.number_of_guests = context.initialPartySize;
  }
  return answers;
}

function inputType(type: RsvpFieldConfig["type"]) {
  switch (type) {
    case "date":
      return "date";
    case "number":
      return "number";
    case "email":
      return "email";
    case "phone":
      return "tel";
    default:
      return "text";
  }
}

function isAttendanceOnlyField(key: string) {
  return key === "number_of_guests" || key === "meal_preference";
}
