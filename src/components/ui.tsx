/**
 * LIFEKIT UI primitives.
 *
 * Accessibility notes that apply across this file:
 *  - Dialog uses the native <dialog> element for correct focus handling and Escape support.
 *  - Form fields always render a real <label> plus hint and error text linked by aria-describedby.
 *  - Errors are announced through role="alert"; status changes use role="status".
 *  - Nothing here renders raw HTML from user input; text goes through React's escaping.
 */
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from './Icons';

/* ------------------------------- buttons ------------------------------- */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, block, children, className, type = 'button', ...rest },
  ref
) {
  const classes = [
    'btn',
    variant === 'secondary' ? 'btn-secondary' : '',
    variant === 'ghost' ? 'btn-ghost' : '',
    variant === 'accent' ? 'btn-accent' : '',
    variant === 'danger' ? 'btn-danger' : '',
    size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, className, type = 'button', ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} className={`btn btn-icon ${className ?? ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={20} />
    </button>
  );
});

/* ------------------------------- layout blocks ------------------------------- */

export function Card({
  title,
  subtitle,
  actions,
  children,
  id,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section className={`card ${className ?? ''}`} id={id} aria-labelledby={title ? headingId : undefined}>
      {(title || actions) && (
        <div className="card-header">
          <div className="grow">
            {title ? (
              <h2 className="card-title" id={headingId}>
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="row">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'income' | 'expense' | 'neutral';
}) {
  const toneClass = tone === 'income' ? 'amount-income' : tone === 'expense' ? 'amount-expense' : '';
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClass}`}>{value}</div>
      {hint ? <div className="tiny muted">{hint}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'danger' | 'warning' | 'info';
}) {
  const cls =
    tone === 'accent'
      ? 'badge badge-accent'
      : tone === 'danger'
        ? 'badge badge-danger'
        : tone === 'warning'
          ? 'badge badge-warning'
          : tone === 'info'
            ? 'badge badge-info'
            : 'badge';
  return <span className={cls}>{children}</span>;
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: ReactNode;
  children: ReactNode;
}) {
  const cls =
    tone === 'warning'
      ? 'notice notice-warning'
      : tone === 'danger'
        ? 'notice notice-danger'
        : tone === 'success'
          ? 'notice notice-success'
          : 'notice';
  return (
    <div className={cls} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={tone === 'warning' || tone === 'danger' ? 'warning' : 'info'} size={20} />
      <div>
        {title ? <strong>{title} </strong> : null}
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ percent, label, tone }: { percent: number; label: string; tone?: 'auto' | 'never-over' }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const over = tone === 'never-over' ? false : percent > 100;
  const warn = !over && percent >= 80;
  return (
    <div
      className="progress"
      data-over={over}
      data-warn={warn}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={48} className="empty-art" />
      <h3>{title}</h3>
      {children ? <div className="small muted">{children}</div> : null}
      {action ? <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- forms ------------------------------- */

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
  id: string;
  children: ReactNode;
  required?: boolean;
}

function FieldShell({ label, hint, error, id, children, required }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, id, required, ...rest },
  ref
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} required={required}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      />
    </FieldShell>
  );
});

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, hint, error, id, required, ...rest },
  ref
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} required={required}>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      />
    </FieldShell>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string | null;
  options: { value: string; label: string }[];
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, id, options, required, ...rest },
  ref
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} required={required}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="switch">
      <span className="switch-text">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {description ? <span className="field-hint">{description}</span> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

export function CheckboxRow({
  label,
  checked,
  onChange,
  description,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        {label}
        {description ? <span className="field-hint" style={{ display: 'block' }}>{description}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------- dialogs ------------------------------- */

/**
 * Modal/Sheet built on the native <dialog>.
 * Native dialogs already trap focus, close on Escape and restore focus to the opener.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  variant = 'modal',
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  variant?: 'modal' | 'sheet';
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Older WebViews and test environments implement only part of the <dialog> API, and an
    // exception thrown here would unmount the whole screen. Every call is therefore guarded
    // and wrapped, falling back to the `open` attribute, which still renders the dialog.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute('open');
        }
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog ref={ref} className={variant} aria-labelledby={labelledBy ?? headingId} onClose={onClose}>
      <div className={variant === 'sheet' ? 'sheet-inner' : 'modal-inner'}>
        <div className="modal-header">
          <h2 className="modal-title" id={headingId}>
            {title}
          </h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Confirmation for destructive actions. The confirm button says exactly what will happen. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = true,
  requireTyping,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  requireTyping?: string;
}) {
  const id = useId();
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open, setTyped]);
  const blocked = Boolean(requireTyping) && typed.trim().toUpperCase() !== requireTyping?.toUpperCase();

  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="small">{message}</div>
      {requireTyping ? (
        <div style={{ marginTop: 12 }}>
          <TextField
            label={`Type ${requireTyping} to confirm`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            id={id}
          />
        </div>
      ) : null}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={blocked}
          data-testid="confirm-action"
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/* ------------------------------- misc ------------------------------- */

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; message: string; kind: 'info' | 'success' | 'error' }[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.kind === 'error' ? 'toast-error' : toast.kind === 'success' ? 'toast-success' : ''}`}
        >
          <Icon name={toast.kind === 'error' ? 'warning' : toast.kind === 'success' ? 'check' : 'info'} size={18} />
          <span className="grow">{toast.message}</span>
          <IconButton icon="close" label="Dismiss message" onClick={() => onDismiss(toast.id)} />
        </div>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="row-between wrap" style={{ marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
      <div className="grow">
        <h1>{title}</h1>
        {description ? <p className="muted" style={{ margin: 0 }}>{description}</p> : null}
      </div>
      {actions ? <div className="btn-row">{actions}</div> : null}
    </header>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer external">
      {children} <Icon name="external" size={14} style={{ verticalAlign: '-2px' }} />
    </a>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="empty" role="status">
      <p className="muted" style={{ margin: 0 }}>
        {label}
      </p>
    </div>
  );
}
