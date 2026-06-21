"use client";

import { InvitationInvitee, InviteeDraft } from "./event-types";

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
  const filteredInvitees = invitees.filter((invitee) =>
    invitee.name.toLowerCase().includes(inviteeSearch.trim().toLowerCase()),
  );

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
          <label className="user-field invitee-upload-field">
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

        <label className="event-search invitee-search">
          <span className="sr-only">Search invitees</span>
          <input
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search invitee"
            value={inviteeSearch}
          />
        </label>

        <div className="mt-4 overflow-x-auto rounded-xl border border-ink/10 bg-white">
          <table className="user-table invitee-link-table">
            <thead>
              <tr>
                <th>Invitee</th>
                <th>Personalized URL</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvitees.map((invitee) => (
                <tr key={invitee.id}>
                  <td>
                    <strong>{invitee.name}</strong>
                    <span>Ready to share</span>
                  </td>
                  <td className="invitee-url">
                    {origin}/invite/{invitee.slug}
                  </td>
                  <td>
                    <div className="invitee-row-actions">
                      <button
                        className="user-secondary-button"
                        onClick={() => onCopyOne(invitee)}
                        type="button"
                      >
                        Copy
                      </button>
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
