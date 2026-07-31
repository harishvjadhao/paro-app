import { useState } from "react";
import { Icon } from "../Icon";
import { fmtTs } from "@/lib/format";
import { useCommentMutations, useComments } from "@/hooks/useComments";

type Props = { symbol: string };

export function CommentsPanel({ symbol }: Props) {
  const { data, isLoading } = useComments(symbol);
  const { add, edit, remove } = useCommentMutations(symbol);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const disabled = !draft.trim() || add.isPending;

  return (
    <section className="card comments-card">
      <div className="card-kicker">Comments</div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a note about this stock…"
        className="comment-input"
      />
      <div className="comment-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={disabled}
          onClick={() => {
            const body = draft.trim();
            if (!body) return;
            add.mutate(body, {
              onSuccess: () => setDraft(""),
            });
          }}
        >
          Add comment
        </button>
      </div>

      <div className="comment-list">
        {isLoading && <div className="muted-center">Loading comments…</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="comment-empty">
            No comments yet. Add the first note above.
          </div>
        )}
        {data?.map((cm) => (
          <div key={cm.id} className="comment-item">
            {editing === cm.id ? (
              <>
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="comment-input is-edit"
                />
                <div className="comment-edit-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      const body = editDraft.trim();
                      if (!body) return;
                      edit.mutate(
                        { id: cm.id, body },
                        { onSuccess: () => setEditing(null) },
                      );
                    }}
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="comment-meta">
                  <span>
                    Created {fmtTs(cm.created_at)} · Updated{" "}
                    {cm.updated_at === cm.created_at
                      ? "—"
                      : fmtTs(cm.updated_at)}
                  </span>
                  <div className="comment-ops">
                    <button
                      type="button"
                      title="Edit"
                      className="icon-plain"
                      onClick={() => {
                        setEditing(cm.id);
                        setEditDraft(cm.body);
                      }}
                    >
                      <Icon name="pencil" size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      className="icon-plain"
                      onClick={() => remove.mutate(cm.id)}
                    >
                      <Icon name="trash-2" size={14} />
                    </button>
                  </div>
                </div>
                <div className="comment-body">{cm.body}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
