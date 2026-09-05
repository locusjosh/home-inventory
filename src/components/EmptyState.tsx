type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="card-lux flex flex-col items-center px-6 py-12 text-center animate-fade-up">
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-soft to-surface-2 shadow-soft"
        aria-hidden
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-accent">
          <rect x="3" y="6" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
