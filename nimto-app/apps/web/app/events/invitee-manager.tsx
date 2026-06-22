"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  onGenerate,
  onInput,
  onPaste,
  onReadCsv,
  onRegenerate,
  onSearch,
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
  onGenerate: () => void;
  onInput: (value: string) => void;
  onPaste: (value: string) => void;
  onReadCsv: (file?: File) => void;
  onRegenerate: (invitee: InvitationInvitee) => void;
  onSearch: (value: string) => void;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const readyCount = draftInvitees.filter(
    (draft) => draft.status === "Ready",
  ).length;
  const [rsvpFilter, setRsvpFilter] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
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
        .sort((left, right) => {
          if (sort === "opened") return right.openCount - left.openCount;
          if (sort === "recent")
            return +new Date(right.updatedAt) - +new Date(left.updatedAt);
          return left.name.localeCompare(right.name);
        }),
    [inviteeSearch, invitees, rsvpFilter, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filteredInvitees.length / pageSize));
  const visibleInvitees = filteredInvitees.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  function downloadSampleCsv() {
    const csv = [
      "Invitee Name",
      "Aarav Sharma",
      "Ishani Kandel",
      "The Adhikari Family",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nimto-invitee-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="event-manager-stack">
      <section className="user-panel">
        <div className="event-section-heading">
          <div>
            <p className="user-kicker">Add invitees</p>
            <h2>Generate personalized links</h2>
            <p>
              Add names manually, paste a list, or upload a CSV. Each guest gets
              a reusable link to this invitation.
            </p>
          </div>
        </div>

        <div className="invitee-input-grid">
          <label className="user-field">
            <span>
              <span>Add manually</span>
              <em>One or more names</em>
            </span>
            <textarea
              onChange={(event) => onInput(event.target.value)}
              placeholder={"Trilochan Kandel\nAsha Sharma"}
              rows={5}
              value={inviteeInput}
            />
          </label>
          <label className="user-field">
            <span>
              <span>Paste a list</span>
              <em>One name per line</em>
            </span>
            <textarea
              onChange={(event) => onPaste(event.target.value)}
              placeholder={"Nishwet Adhikari\nJoon Shakya"}
              rows={5}
              value={inviteePaste}
            />
          </label>
          <div className="invitee-upload-field">
            <label className="user-field">
              <span>
                <span>Upload CSV</span>
                <em>First column is used</em>
              </span>
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
        </div>

        {draftInvitees.length ? (
          <div className="invitee-draft-panel">
            <div className="overflow-x-auto">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Invitee name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {draftInvitees.map((draft, index) => (
                    <tr key={`${draft.name}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{draft.name || "Empty"}</td>
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
                {readyCount} valid {readyCount === 1 ? "name" : "names"}
              </span>
              <button
                className="user-primary-button"
                disabled={!readyCount || isSaving}
                onClick={onGenerate}
                type="button"
              >
                {isSaving ? "Generating..." : `Generate ${readyCount} links`}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="user-panel">
        <div className="event-section-heading event-links-heading">
          <div>
            <p className="user-kicker">Invitee history</p>
            <h2>Generated links</h2>
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
            <span className="sr-only">Search invitees</span>
            <input
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search invitee"
              value={inviteeSearch}
            />
          </label>
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

        <div className="mt-4 overflow-x-auto rounded-xl border border-ink/10 bg-white">
          <table className="user-table invitee-link-table">
            <thead>
              <tr>
                <th>Invitee</th>
                <th>Engagement</th>
                <th>RSVP</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvitees.map((invitee) => (
                <tr key={invitee.id}>
                  <td>
                    <strong>{invitee.name}</strong>
                    <span>{origin}/invite/{invitee.slug}</span>
                  </td>
                  <td>
                    <strong>{invitee.openCount || 0} opens</strong>
                    <span>
                      {invitee.lastOpenedAt
                        ? `Last opened ${new Date(invitee.lastOpenedAt).toLocaleDateString()}`
                        : "Not opened yet"}
                    </span>
                  </td>
                  <td>
                    <span className={`rsvp-status ${invitee.rsvpStatus.toLowerCase()}`}>
                      {invitee.rsvpStatus.toLowerCase()}
                    </span>
                    {invitee.rsvpStatus === "ATTENDING" ? (
                      <span>{invitee.partySize ?? 1} guest(s)</span>
                    ) : null}
                  </td>
                  <td>
                    <div className="invitee-row-actions">
                      <Link
                        className="user-secondary-button"
                        href={`/invite/${invitee.slug}`}
                        target="_blank"
                      >
                        Preview
                      </Link>
                      <button
                        className="user-secondary-button"
                        onClick={() => onCopyOne(invitee)}
                        type="button"
                      >
                        Copy
                      </button>
                      <a
                        className="user-secondary-button"
                        href={`https://wa.me/?text=${encodeURIComponent(`${invitee.name}, your invitation: ${origin}/invite/${invitee.slug}`)}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        WhatsApp
                      </a>
                      <InvitationQrCode
                        label={invitee.name}
                        url={`${origin}/invite/${invitee.slug}`}
                      />
                      <button
                        className="user-secondary-button"
                        onClick={() => onRegenerate(invitee)}
                        type="button"
                      >
                        Regenerate
                      </button>
                      <button
                        className="user-danger-button"
                        onClick={() => onDelete(invitee)}
                        type="button"
                      >
                        Delete
                      </button>
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
                ? "No invitees match your search."
                : "No invitee links yet. Add names above when you are ready."}
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
