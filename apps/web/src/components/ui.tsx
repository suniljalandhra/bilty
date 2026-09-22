'use client';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { paiseInput, parseRupees } from '@/lib/model';
export function Brand() {
  return (
    <Link href="/biltys" className="brand">
      <span className="brand-mark">B</span>
      <span>
        Bilty<span className="brand-caption">TRANSPORT WORKSPACE</span>
      </span>
    </Link>
  );
}
export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}
export function ErrorNotice({ message }: { message?: string | null }) {
  return message ? (
    <div className="notice error" role="alert">
      {message}
    </div>
  ) : null;
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>
        ▤
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}
export function Field({
  label,
  hint,
  children,
  className = '',
  controlId,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  controlId: string;
}) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={controlId}>
        {label}
      </label>
      {children}
      {hint && (
        <span className="hint" id={`${controlId}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}
export function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const generatedId = useId(),
    id = props.id || generatedId;
  return (
    <Field label={label} hint={hint} controlId={id}>
      <input
        maxLength={2000}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
        id={id}
      />
    </Field>
  );
}
export function TextArea({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const generatedId = useId(),
    id = props.id || generatedId;
  return (
    <Field label={label} hint={hint} controlId={id}>
      <textarea
        rows={3}
        maxLength={10000}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
        id={id}
      />
    </Field>
  );
}
export function Select({
  label,
  hint,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const generatedId = useId(),
    id = props.id || generatedId;
  return (
    <Field label={label} hint={hint} controlId={id}>
      <select aria-describedby={hint ? `${id}-hint` : undefined} {...props} id={id}>
        {children}
      </select>
    </Field>
  );
}
export function MoneyInput({
  label,
  value,
  onChange,
  nullable = true,
  required = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  nullable?: boolean;
  required?: boolean;
}) {
  const [raw, setRaw] = useState(paiseInput(value));
  const id = useId();
  const input = useRef<HTMLInputElement>(null),
    lastValue = useRef(value);
  useEffect(() => {
    if (lastValue.current !== value) {
      setRaw(paiseInput(value));
      input.current?.setCustomValidity('');
      lastValue.current = value;
    }
  }, [value]);
  return (
    <Field label={label} controlId={id}>
      <div className="money-input">
        <span aria-hidden>₹</span>
        <input
          id={id}
          ref={input}
          inputMode="decimal"
          aria-label={label}
          required={required}
          value={raw}
          placeholder="0.00"
          onChange={(event) => {
            setRaw(event.target.value);
            try {
              const parsed = parseRupees(event.target.value);
              const next = parsed ?? (nullable ? null : 0);
              event.target.setCustomValidity('');
              lastValue.current = next;
              onChange(next);
            } catch (error) {
              event.target.setCustomValidity((error as Error).message);
            }
          }}
          onBlur={() => {
            if (input.current?.validity.valid && raw) setRaw(paiseInput(value));
          }}
        />
      </div>
    </Field>
  );
}
export function Section({
  title,
  description,
  children,
  action,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section className="card section" id={id}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        // Native Escape must not close the dialog if its owner refuses to close.
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function useDirtyForm(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const leave = (event: MouseEvent) => {
      const target = event.target as Element,
        anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        anchor.href === window.location.href ||
        anchor.getAttribute('href')?.startsWith('#')
      )
        return;
      if (!window.confirm('You have unsaved changes. Leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    // Navigation fires before the URL changes and before Next handles popstate.
    // Cancel the traversal itself so the form and history stack remain intact.
    // Browsers without Navigation API retain link and document-unload protection.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      const transition = event as Event & {
        navigationType?: string;
        destination?: { sameDocument: boolean };
      };
      if (
        transition.navigationType === 'traverse' &&
        transition.destination?.sameDocument &&
        event.cancelable &&
        !window.confirm('You have unsaved changes. Leave this page?')
      )
        event.preventDefault();
    };
    navigation?.addEventListener('navigate', traverse);
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', leave, true);
    return () => {
      navigation?.removeEventListener('navigate', traverse);
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', leave, true);
    };
  }, [dirty]);
}
export function Pagination({
  offset,
  count,
  limit,
  onChange,
  busy = false,
}: {
  offset: number;
  count: number;
  limit: number;
  onChange: (offset: number) => void;
  busy?: boolean;
}) {
  return (
    <div className="pagination">
      <span>{count ? `${offset + 1}–${offset + count}` : '0'} records</span>
      <div className="actions">
        <button disabled={!offset || busy} onClick={() => onChange(Math.max(0, offset - limit))}>
          Previous
        </button>
        <button
          disabled={count < limit || offset + limit > 100000 || busy}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
