import { type ReactNode, useId } from 'react';

export const inputClasses =
  'w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-base text-blue-950 aria-invalid:border-red-600';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
}

/** Label, hint, control and error message, wired together for screen readers. */
function Field({
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { children: (ids: { id: string; describedBy?: string }) => ReactNode }) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
        {!required && <span className="font-normal"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mb-1 text-sm">
          {hint}
        </p>
      )}
      {children({ id, describedBy })}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  type = 'text',
  maxLength,
  inputMode,
  autoComplete,
  ...field
}: FieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'url' | 'email' | 'password' | 'date' | 'number';
  maxLength?: number;
  inputMode?: 'numeric' | 'url' | 'email';
  autoComplete?: string;
}) {
  return (
    <Field {...field}>
      {({ id, describedBy }) => (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required={field.required}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClasses}
        />
      )}
    </Field>
  );
}

export function TextAreaField({
  value,
  onChange,
  rows = 5,
  maxLength,
  ...field
}: FieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <Field {...field}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          required={field.required}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClasses}
        />
      )}
    </Field>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  ...field
}: FieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  /** First, empty option, e.g. "Choose a region" or "None". */
  placeholder?: string;
}) {
  return (
    <Field {...field}>
      {({ id, describedBy }) => (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClasses}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Form-level error, e.g. a conflict or connection problem, announced when it appears. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
      {message}
    </p>
  );
}

/** Lists field errors at the top of a form, announced when they appear. */
export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const fieldErrors = Object.entries(errors).filter(([path]) => path !== '');
  if (fieldErrors.length === 0) return <FormError message={errors['']} />;
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
      <p className="font-semibold">Check the following and try again:</p>
      <ul className="mt-1 list-disc pl-6">
        {fieldErrors.map(([path, message]) => (
          <li key={path}>{message}</li>
        ))}
      </ul>
      {errors[''] && <p className="mt-2">{errors['']}</p>}
    </div>
  );
}
