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

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        className={`cabagges-pill py-2.5 px-4 text-xs font-medium floating-dispatch-reopen ${
          open ? 'is-hidden' : 'is-visible'
        }`}
      >
        + Bite Dispatch
      </button>

      <aside
        className={`floating-dispatch-card ${open ? 'is-open' : 'is-closed'}`}
        aria-label="Add Substack publication"
        aria-hidden={!open}
      >
        <button
          type="button"
          className="floating-dispatch-close"
          aria-label="Dismiss card"
          tabIndex={open ? 0 : -1}
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
            tabIndex={open ? 0 : -1}
            onChange={(event) => onPublicationChange(event.target.value)}
            placeholder="Substack handle or URL"
          />
          <button type="submit" disabled={submitting} tabIndex={open ? 0 : -1}>
            {submitting ? '...' : 'Add'}
          </button>
        </form>
      </aside>
    </>
  );
}
