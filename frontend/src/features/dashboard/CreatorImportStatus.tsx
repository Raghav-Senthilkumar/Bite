import type { ImportProgress } from './importProgress';

interface CreatorImportStatusProps {
  progress: ImportProgress;
  variant?: 'banner' | 'inline' | 'card';
  onDismiss?: () => void;
}

export function CreatorImportStatus({
  progress,
  variant = 'banner',
  onDismiss,
}: CreatorImportStatusProps) {
  const active = progress.phase !== 'complete' && progress.phase !== 'failed';
  const className = [
    'import-status',
    variant === 'banner' ? 'is-banner' : 'is-inline',
    variant === 'card' ? 'is-card' : '',
    progress.phase === 'complete' ? 'is-complete' : '',
    progress.phase === 'failed' ? 'is-failed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      role="status"
      aria-live={variant === 'banner' ? 'polite' : 'off'}
      aria-busy={active}
    >
      <div className="import-status-header">
        <p className="import-status-title">
          {active && <span className="spinner spinner-sm" aria-hidden="true" />}
          <span>{progress.title}</span>
        </p>
        {variant === 'banner' && onDismiss && (
          <button type="button" className="import-status-dismiss" onClick={onDismiss} aria-label="Dismiss import status">
            ×
          </button>
        )}
      </div>
      <p className="import-status-detail">{progress.detail}</p>
      <div
        className="import-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total || 100}
        aria-valuenow={progress.percent ?? undefined}
        aria-valuetext={progress.detail}
      >
        <span
          className={`import-progress-fill ${progress.percent === null ? 'is-indeterminate' : ''}`}
          style={progress.percent === null ? undefined : { width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
