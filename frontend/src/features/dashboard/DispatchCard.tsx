import type { FormEvent } from 'react';

interface DispatchCardProps {
  open: boolean;
  publication: string;
  submitting: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPublicationChange: (publication: string) => void;
  onSubmit: () => void;
}

export function DispatchCard({
  open,
  publication,
  submitting,
  onOpen,
  onClose,
  onPublicationChange,
  onSubmit,
}: DispatchCardProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="cabagges-pill py-2.5 px-4 text-xs font-medium floating-dispatch-reopen"
      >
        + Bite Dispatch
      </button>
    );
  }

  return (
    <aside className="floating-dispatch-card" aria-label="Add Substack publication">
      <button
        type="button"
        className="floating-dispatch-close"
        aria-label="Dismiss card"
        onClick={onClose}
      >
        ×
      </button>
      <h3>Bite Dispatch</h3>
      <p>
        Paste a public Substack URL or handle to import new recipes, ingredients,
        and cooking steps into your shelf!
      </p>
      <form className="dispatch-input-bar" onSubmit={handleSubmit}>
        <input
          aria-label="Substack URL or handle"
          value={publication}
          onChange={(event) => onPublicationChange(event.target.value)}
          placeholder="Substack handle or URL"
        />
        <button type="submit" disabled={submitting}>
          {submitting ? '...' : 'Add'}
        </button>
      </form>
    </aside>
  );
}
