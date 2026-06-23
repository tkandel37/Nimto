"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { InvitationInvitee, InviteeDraft } from "./event-types";
import { InvitationQrCode } from "./qr-code";

export function InviteeManager({
  draftInvitees,
  inviteeInput,
  inviteePaste,
  inviteeSearch,
  invitees,
  isLoading,
  isSaving,
  onCopyAll,
  onCopyOne,
  onDelete,
  onDownload,
  onEdit,
  onGenerate,
  onInput,
  onPaste,
  onReadCsv,
  onRegenerate,
  onShare,
  onSearch,
  onToggleLink,
}: {
  draftInvitees: InviteeDraft[];
  inviteeInput: string;
  inviteePaste: string;
  inviteeSearch: string;
  invitees: InvitationInvitee[];
  isLoading: boolean;
  isSaving: boolean;
  onCopyAll: () => void;
  onCopyOne: (invitee: InvitationInvitee) => void;
  onDelete: (invitee: InvitationInvitee) => void;
  onDownload: () => void;
  onEdit: (invitee: InvitationInvitee, values: Record<string, unknown>) => void;
  onGenerate: () => void;
  onInput: (value: string) => void;
  onPaste: (value: string) => void;
  onReadCsv: (file?: File) => void;
  onRegenerate: (invitee: InvitationInvitee) => void;
  onShare: (invitee: InvitationInvitee, channel: string) => void;
  onSearch: (value: string) => void;
  onToggleLink: (invitee: InvitationInvitee) => void;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const readyCount = draftInvitees.filter(
    (draft) => draft.status === "Ready",
  ).length;
  const [rsvpFilter, setRsvpFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [selectedInvitee, setSelectedInvitee] =
    useState<InvitationInvitee | null>(null);
  const [showAddGuests, setShowAddGuests] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "paste" | "csv">("manual");
  const [actionInviteeId, setActionInviteeId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const pageSize = 15;
  const filteredInvitees = useMemo(
    () =>
      invitees
        .filter(
          (invitee) =>
            invitee.name
              .toLowerCase()
              .includes(inviteeSearch.trim().toLowerCase()) &&
            (rsvpFilter === "ALL" || invitee.rsvpStatus === rsvpFilter),
        )
        .filter(
          (invitee) =>
            groupFilter === "ALL" ||
            (invitee.groupName ?? "Ungrouped") === groupFilter,
        )
        .sort((left, right) => {
          if (sort === "opened") return right.openCount - left.openCount;
          if (sort === "recent")
            return +new Date(right.updatedAt) - +new Date(left.updatedAt);
          return left.name.localeCompare(right.name);
        }),
    [groupFilter, inviteeSearch, invitees, rsvpFilter, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filteredInvitees.length / pageSize));
  const visibleInvitees = filteredInvitees.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  function downloadSampleCsv() {
    const csv = [
      "Guest Name,Email,Phone,Group,Meal Preference",
      "Aarav Sharma,aarav@example.com,+9779800000000,Friends,Vegetarian",
      "Ishani Kandel,ishani@example.com,+9779811111111,Family,Vegan",
      "The Adhikari Family,,,Family,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nimto-guest-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="event-manager-stack">
      <section className="user-panel">
        <div className="event-section-heading">
          <div>
            <p className="user-kicker">Guests</p>
            <h2>Guest list and personalized links</h2>
            <p>
              Add guests when you need them. Each person receives a reusable,
              trackable invitation link.
            </p>
          </div>
          <button
            className="user-primary-button"
            onClick={() => setShowAddGuests(true)}
            type="button"
          >
            Add guests
          </button>
        </div>
      </section>

      <section className="user-panel">
        <div className="event-section-heading event-links-heading">
          <div>
            <p className="user-kicker">Guest history</p>
            <h2>
              {invitees.length ? `${invitees.length} guests` : "No guests yet"}
            </h2>
            <p>
              Keep, copy, download, regenerate, or remove links whenever you
              need them.
            </p>
          </div>
          <div className="event-link-actions">
            <button
              className="user-secondary-button"
              disabled={!invitees.length}
              onClick={onCopyAll}
              type="button"
            >
              Copy all
            </button>
            <button
              className="user-secondary-button"
              disabled={!invitees.length}
              onClick={onDownload}
              type="button"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="invitee-filter-row">
          <label className="event-search invitee-search">
            <span className="sr-only">Search guests</span>
            <input
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search guests"
              value={inviteeSearch}
            />
          </label>
          <button
            className="user-secondary-button invitee-filter-toggle"
            onClick={() => setShowFilters((value) => !value)}
            type="button"
          >
            Filters {rsvpFilter !== "ALL" || groupFilter !== "ALL" ? "•" : ""}
          </button>
          <div
            className={
              showFilters
                ? "invitee-advanced-filters open"
                : "invitee-advanced-filters"
            }
          >
            <select
              aria-label="Filter RSVP status"
              onChange={(event) => {
                setRsvpFilter(event.target.value);
                setPage(1);
              }}
              value={rsvpFilter}
            >
              <option value="ALL">All responses</option>
              <option value="PENDING">Pending</option>
              <option value="ATTENDING">Attending</option>
              <option value="DECLINED">Declined</option>
            </select>
            <select
              aria-label="Filter guest group"
              onChange={(event) => {
                setGroupFilter(event.target.value);
                setPage(1);
              }}
              value={groupFilter}
            >
              <option value="ALL">All groups</option>
              {Array.from(
                new Set(
                  invitees.map((invitee) => invitee.groupName ?? "Ungrouped"),
                ),
              ).map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort invitees"
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              value={sort}
            >
              <option value="name">Name A–Z</option>
              <option value="recent">Recently updated</option>
              <option value="opened">Most opened</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-ink/10 bg-white">
          <table className="user-table invitee-link-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Group</th>
                <th>RSVP</th>
                <th>Opens</th>
                <th>Last shared</th>
                <th className="text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleInvitees.map((invitee) => (
                <tr key={invitee.id}>
                  <td data-label="Guest">
                    <button
                      className="invitee-name-button"
                      onClick={() => setSelectedInvitee(invitee)}
                      type="button"
                    >
                      <strong>{invitee.name}</strong>
                    </button>
                    <span>
                      {invitee.email || invitee.phone || "Personal invitation"}
                    </span>
                  </td>
                  <td data-label="Group">
                    <span>{invitee.groupName || "Ungrouped"}</span>
                  </td>
                  <td data-label="RSVP">
                    <span
                      className={`rsvp-status ${invitee.rsvpStatus.toLowerCase()}`}
                    >
                      {invitee.rsvpStatus === "PENDING"
                        ? invitee.openCount
                          ? "Awaiting response"
                          : "Not opened"
                        : invitee.rsvpStatus === "ATTENDING"
                          ? "Attending"
                          : "Declined"}
                    </span>
                    {invitee.rsvpStatus === "ATTENDING" ? (
                      <span>{invitee.partySize ?? 1} guest(s)</span>
                    ) : null}
                  </td>
                  <td data-label="Opens">
                    <strong>{invitee.openCount || 0}</strong>
                  </td>
                  <td data-label="Last shared">
                    <span>
                      {invitee.lastSharedAt
                        ? new Date(invitee.lastSharedAt).toLocaleDateString()
                        : "Not shared"}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="guest-action-menu">
                      <button
                        aria-expanded={actionInviteeId === invitee.id}
                        aria-label={`Actions for ${invitee.name}`}
                        className="guest-action-trigger"
                        onClick={() =>
                          setActionInviteeId((current) =>
                            current === invitee.id ? "" : invitee.id,
                          )
                        }
                        type="button"
                      >
                        •••
                      </button>
                      {actionInviteeId === invitee.id ? (
                        <div className="guest-action-popover">
                          <Link
                            href={`/invite/${invitee.slug}`}
                            target="_blank"
                          >
                            Preview invitation
                          </Link>
                          <button
                            onClick={() => onCopyOne(invitee)}
                            type="button"
                          >
                            Copy link
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`${invitee.name}, your invitation: ${origin}/invite/${invitee.slug}`)}`}
                            onClick={() => onShare(invitee, "WHATSAPP")}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Share on WhatsApp
                          </a>
                          <InvitationQrCode
                            label={invitee.name}
                            url={`${origin}/invite/${invitee.slug}`}
                          />
                          <button
                            onClick={() => onRegenerate(invitee)}
                            type="button"
                          >
                            Regenerate link
                          </button>
                          <button
                            onClick={() => onToggleLink(invitee)}
                            type="button"
                          >
                            {invitee.linkDisabledAt
                              ? "Enable link"
                              : "Disable link"}
                          </button>
                          <button
                            className="danger"
                            onClick={() => onDelete(invitee)}
                            type="button"
                          >
                            Delete guest
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading ? (
            <p className="p-5 text-sm text-ink/55">Loading invitee links...</p>
          ) : null}
          {!isLoading && !filteredInvitees.length ? (
            <p className="p-5 text-sm text-ink/55">
              {invitees.length
                ? "No guests match your search."
                : "No guests yet. Add your first guest to create a personalized invitation link."}
            </p>
          ) : null}
        </div>
        {filteredInvitees.length > pageSize ? (
          <div className="invitee-pagination">
            <button
              className="user-secondary-button"
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              className="user-secondary-button"
              disabled={page === pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
      {selectedInvitee ? (
        <InviteeDrawer
          invitee={selectedInvitee}
          onClose={() => setSelectedInvitee(null)}
          onSave={(values) => {
            onEdit(selectedInvitee, values);
            setSelectedInvitee(null);
          }}
        />
      ) : null}
      {showAddGuests ? (
        <div
          className="invitee-drawer-backdrop"
          onMouseDown={() => setShowAddGuests(false)}
        >
          <section
            className="guest-add-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="event-section-heading">
              <div>
                <p className="user-kicker">Add guests</p>
                <h2>How would you like to add them?</h2>
              </div>
              <button
                className="user-secondary-button"
                onClick={() => setShowAddGuests(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="guest-add-tabs">
              {(["manual", "paste", "csv"] as const).map((mode) => (
                <button
                  className={addMode === mode ? "active" : ""}
                  key={mode}
                  onClick={() => setAddMode(mode)}
                  type="button"
                >
                  {mode === "csv"
                    ? "Upload CSV"
                    : mode === "paste"
                      ? "Paste list"
                      : "Add manually"}
                </button>
              ))}
            </div>
            {addMode === "manual" ? (
              <label className="user-field">
                <span>
                  Guest names <em>One per line</em>
                </span>
                <textarea
                  onChange={(event) => onInput(event.target.value)}
                  placeholder={"Trilochan Kandel\nAsha Sharma"}
                  rows={6}
                  value={inviteeInput}
                />
              </label>
            ) : null}
            {addMode === "paste" ? (
              <label className="user-field">
                <span>
                  Paste your list <em>One name per line</em>
                </span>
                <textarea
                  onChange={(event) => onPaste(event.target.value)}
                  placeholder={"Nishwet Adhikari\nJoon Shakya"}
                  rows={6}
                  value={inviteePaste}
                />
              </label>
            ) : null}
            {addMode === "csv" ? (
              <div className="guest-csv-zone">
                <label
                  className={
                    isDraggingCsv
                      ? "guest-csv-dropzone dragging"
                      : "guest-csv-dropzone"
                  }
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingCsv(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDraggingCsv(false);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingCsv(false);
                    onReadCsv(event.dataTransfer.files?.[0]);
                  }}
                >
                  <span className="guest-csv-icon">⇧</span>
                  <strong>Drop your CSV here</strong>
                  <span>or click to choose a file</span>
                  <em>You can review and map columns before importing</em>
                  <input
                    accept=".csv,text/csv"
                    onChange={(event) => onReadCsv(event.target.files?.[0])}
                    type="file"
                  />
                </label>
                <button
                  className="user-secondary-button"
                  onClick={downloadSampleCsv}
                  type="button"
                >
                  Download sample CSV
                </button>
              </div>
            ) : null}
            {addMode !== "csv" && draftInvitees.length ? (
              <div className="invitee-draft-panel">
                <div className="overflow-x-auto">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Guest name</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftInvitees.map((draft, index) => (
                        <tr key={`${draft.name}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{draft.name}</td>
                          <td>
                            <span
                              className={
                                draft.status === "Ready"
                                  ? "invitee-ready"
                                  : "invitee-warning"
                              }
                            >
                              {draft.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="invitee-draft-action">
                  <span>
                    {readyCount} valid {readyCount === 1 ? "guest" : "guests"}
                  </span>
                  <button
                    className="user-primary-button"
                    disabled={!readyCount || isSaving}
                    onClick={() => {
                      onGenerate();
                      setShowAddGuests(false);
                    }}
                    type="button"
                  >
                    {isSaving ? "Adding…" : `Add ${readyCount} guests`}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function InviteeDrawer({
  invitee,
  onClose,
  onSave,
}: {
  invitee: InvitationInvitee;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      groupName: form.get("groupName"),
      organizerNotes: form.get("organizerNotes"),
      rsvpStatus: form.get("rsvpStatus"),
      partySize: Number(form.get("partySize") || 1),
      mealPreference: form.get("mealPreference"),
      rsvpMessage: form.get("rsvpMessage"),
      linkExpiresAt: form.get("linkExpiresAt") || null,
    });
  }

  return (
    <div className="invitee-drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="invitee-detail-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-section-heading">
          <div>
            <p className="user-kicker">Guest details</p>
            <h2>{invitee.name}</h2>
          </div>
          <div className="event-header-actions">
            {!isEditing ? (
              <button
                className="user-primary-button"
                onClick={() => setIsEditing(true)}
                type="button"
              >
                Edit
              </button>
            ) : null}
            <button
              className="user-secondary-button"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
        <div className="invitee-engagement-summary">
          <span>{invitee.openCount} opens</span>
          <span>
            {invitee.lastSharedAt
              ? `Shared via ${invitee.lastShareChannel?.toLowerCase()}`
              : "Not shared yet"}
          </span>
          <span>
            {invitee.respondedAt
              ? `Responded ${new Date(invitee.respondedAt).toLocaleDateString()}`
              : "No response yet"}
          </span>
        </div>
        {!isEditing ? (
          <div className="guest-detail-summary">
            <div>
              <span>Email</span>
              <strong>{invitee.email || "Not provided"}</strong>
            </div>
            <div>
              <span>Phone / WhatsApp</span>
              <strong>{invitee.phone || "Not provided"}</strong>
            </div>
            <div>
              <span>Group</span>
              <strong>{invitee.groupName || "Ungrouped"}</strong>
            </div>
            <div>
              <span>RSVP</span>
              <strong>{invitee.rsvpStatus.toLowerCase()}</strong>
            </div>
            <div>
              <span>Party size</span>
              <strong>{invitee.partySize ?? 1}</strong>
            </div>
            <div>
              <span>Meal preference</span>
              <strong>{invitee.mealPreference || "Not provided"}</strong>
            </div>
            <div className="full">
              <span>Guest message</span>
              <strong>{invitee.rsvpMessage || "No message"}</strong>
            </div>
            <div className="full">
              <span>Private organizer notes</span>
              <strong>{invitee.organizerNotes || "No notes"}</strong>
            </div>
          </div>
        ) : (
          <form className="invitee-detail-form" onSubmit={submit}>
            <label className="user-field">
              <span>Name</span>
              <input defaultValue={invitee.name} name="name" required />
            </label>
            <label className="user-field">
              <span>Email</span>
              <input
                defaultValue={invitee.email ?? ""}
                name="email"
                type="email"
              />
            </label>
            <label className="user-field">
              <span>Phone / WhatsApp</span>
              <input defaultValue={invitee.phone ?? ""} name="phone" />
            </label>
            <label className="user-field">
              <span>Group or family</span>
              <input defaultValue={invitee.groupName ?? ""} name="groupName" />
            </label>
            <label className="user-field">
              <span>RSVP status</span>
              <select defaultValue={invitee.rsvpStatus} name="rsvpStatus">
                <option value="PENDING">Pending</option>
                <option value="ATTENDING">Attending</option>
                <option value="DECLINED">Declined</option>
              </select>
            </label>
            <label className="user-field">
              <span>Party size</span>
              <input
                defaultValue={invitee.partySize ?? 1}
                max={20}
                min={1}
                name="partySize"
                type="number"
              />
            </label>
            <label className="user-field">
              <span>Meal preference</span>
              <input
                defaultValue={invitee.mealPreference ?? ""}
                name="mealPreference"
              />
            </label>
            <label className="user-field">
              <span>Guest message</span>
              <textarea
                defaultValue={invitee.rsvpMessage ?? ""}
                name="rsvpMessage"
                rows={3}
              />
            </label>
            <label className="user-field">
              <span>Private organizer notes</span>
              <textarea
                defaultValue={invitee.organizerNotes ?? ""}
                name="organizerNotes"
                rows={3}
              />
            </label>
            <label className="user-field">
              <span>Link expiry</span>
              <input
                defaultValue={invitee.linkExpiresAt?.slice(0, 16) ?? ""}
                name="linkExpiresAt"
                type="datetime-local"
              />
            </label>
            <div className="event-header-actions">
              <button className="user-primary-button" type="submit">
                Save guest details
              </button>
              <button
                className="user-secondary-button"
                onClick={() => setIsEditing(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}

export function validateInviteeDrafts(
  names: string[],
  existingInvitees: InvitationInvitee[],
): InviteeDraft[] {
  const existing = new Set(
    existingInvitees.map((invitee) => invitee.name.toLowerCase()),
  );
  const seen = new Set<string>();
  return names
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((name) => {
      const key = name.toLowerCase();
      let status: InviteeDraft["status"] = "Ready";
      if (!name) status = "Empty name";
      else if (name.length > 120) status = "Too long";
      else if (!/^[\p{L}\p{M}\d .,'&-]+$/u.test(name))
        status = "Invalid character";
      else if (existing.has(key) || seen.has(key)) status = "Duplicate";
      seen.add(key);
      return { name, status };
    });
}

export function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
