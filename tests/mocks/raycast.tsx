import React, { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from "react";
import { vi } from "vitest";

type FormValue = string | Date | null;
type FormValues = Record<string, FormValue>;

type FormContextValue = {
  values: FormValues;
  defaults: FormValues;
  setValue: (id: string, value: FormValue) => void;
  registerDefault: (id: string, value: FormValue) => void;
  getValue: (id: string, defaultValue: FormValue) => FormValue;
  getValues: () => FormValues;
};

const FormContext = createContext<FormContextValue | null>(null);

const preferencesState: Record<string, unknown> = {};
const localStorageState = new Map<string, string>();

let confirmAlertResult = true;

export const navigationPushMock = vi.fn();
export const navigationPopMock = vi.fn();
export const showToastMock = vi.fn(async (options?: unknown) => options);
export const confirmAlertMock = vi.fn(async () => confirmAlertResult);
export const openExtensionPreferencesMock = vi.fn();
export const popToRootMock = vi.fn(async () => undefined);
export const launchCommandMock = vi.fn(async () => undefined);

function renderActions(actions: ReactNode): ReactNode {
  return actions ? <div data-testid="raycast-actions">{actions}</div> : null;
}

function useFormState(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("Form control rendered outside Form");
  }
  return ctx;
}

function fieldValue(values: FormValues, id: string, defaultValue: FormValue): FormValue {
  return Object.prototype.hasOwnProperty.call(values, id) ? values[id] : defaultValue;
}

function toDateInputValue(value: FormValue): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "";
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function Action({
  title,
  onAction,
  children,
}: PropsWithChildren<{ title?: string; onAction?: () => void }>) {
  return (
    <button type="button" onClick={() => onAction?.()}>
      {title ?? children}
    </button>
  );
}

Action.Style = {
  Destructive: "destructive",
};

Action.SubmitForm = function SubmitForm({
  title,
  onSubmit,
}: {
  title: string;
  onSubmit: (values: Record<string, FormValue>) => void;
}) {
  const ctx = useFormState();

  return (
    <button type="button" onClick={() => onSubmit(ctx.getValues())}>
      {title}
    </button>
  );
};

Action.OpenInBrowser = function OpenInBrowser({ title, url }: { title: string; url: string }) {
  return (
    <a href={url} rel="noreferrer" target="_blank">
      {title}
    </a>
  );
};

export function ActionPanel({ children }: PropsWithChildren) {
  return <div data-testid="action-panel">{children}</div>;
}

ActionPanel.Section = function ActionPanelSection({
  title,
  children,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <section aria-label={title ?? "Action Section"}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  );
};

export function Detail({
  markdown,
  navigationTitle,
  isLoading,
  actions,
}: {
  markdown: string;
  navigationTitle?: string;
  isLoading?: boolean;
  actions?: ReactNode;
}) {
  return (
    <section aria-label={navigationTitle ?? "Detail"}>
      {isLoading ? <span>Loading</span> : null}
      <pre>{markdown}</pre>
      {renderActions(actions)}
    </section>
  );
}

export function Form({
  children,
  actions,
  isLoading,
  navigationTitle,
}: PropsWithChildren<{ actions?: ReactNode; isLoading?: boolean; navigationTitle?: string }>) {
  const [values, setValues] = useState<FormValues>({});
  const [defaults, setDefaults] = useState<FormValues>({});
  const contextValue = useMemo<FormContextValue>(
    () => ({
      values,
      defaults,
      setValue: (id, value) => setValues((current) => ({ ...current, [id]: value })),
      registerDefault: (id, value) =>
        setDefaults((current) =>
          Object.prototype.hasOwnProperty.call(current, id) ? current : { ...current, [id]: value },
        ),
      getValue: (id, defaultValue) => fieldValue(values, id, fieldValue(defaults, id, defaultValue)),
      getValues: () => ({ ...defaults, ...values }),
    }),
    [defaults, values],
  );

  return (
    <FormContext.Provider value={contextValue}>
      <form aria-label={navigationTitle ?? "Form"}>
        {isLoading ? <span>Loading</span> : null}
        {children}
        {renderActions(actions)}
      </form>
    </FormContext.Provider>
  );
}

Form.TextField = function TextField({
  id,
  title,
  defaultValue = "",
  placeholder,
}: {
  id: string;
  title: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const ctx = useFormState();
  useEffect(() => {
    ctx.registerDefault(id, defaultValue);
  }, [ctx, defaultValue, id]);
  const value = String(ctx.getValue(id, defaultValue) ?? "");

  return (
    <label>
      <span>{title}</span>
      <input
        aria-label={title}
        placeholder={placeholder}
        value={value}
        onChange={(event) => ctx.setValue(id, event.currentTarget.value)}
      />
    </label>
  );
};

Form.TextArea = function TextArea({
  id,
  title,
  defaultValue = "",
}: {
  id: string;
  title: string;
  defaultValue?: string;
  enableMarkdown?: boolean;
}) {
  const ctx = useFormState();
  useEffect(() => {
    ctx.registerDefault(id, defaultValue);
  }, [ctx, defaultValue, id]);
  const value = String(ctx.getValue(id, defaultValue) ?? "");

  return (
    <label>
      <span>{title}</span>
      <textarea
        aria-label={title}
        value={value}
        onChange={(event) => ctx.setValue(id, event.currentTarget.value)}
      />
    </label>
  );
};

Form.Description = function Description({ title, text }: { title: string; text: string }) {
  return (
    <div>
      {title ? <strong>{title}</strong> : null}
      <span>{text}</span>
    </div>
  );
};

Form.DatePicker = function DatePicker({
  id,
  title,
  defaultValue = null,
}: {
  id: string;
  title: string;
  defaultValue?: Date | null;
  type?: string;
}) {
  const ctx = useFormState();
  useEffect(() => {
    ctx.registerDefault(id, defaultValue);
  }, [ctx, defaultValue, id]);
  const value = ctx.getValue(id, defaultValue);

  return (
    <label>
      <span>{title}</span>
      <input
        aria-label={title}
        type="date"
        value={toDateInputValue(value)}
        onChange={(event) => ctx.setValue(id, parseDateInputValue(event.currentTarget.value))}
      />
    </label>
  );
};

Form.DatePicker.Type = {
  Date: "date",
};

Form.Dropdown = function Dropdown({
  id,
  title,
  defaultValue = "",
  onChange,
  children,
}: PropsWithChildren<{
  id: string;
  title: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}>) {
  const ctx = useFormState();
  useEffect(() => {
    ctx.registerDefault(id, defaultValue);
  }, [ctx, defaultValue, id]);
  const value = String(ctx.getValue(id, defaultValue) ?? defaultValue);

  return (
    <label>
      <span>{title}</span>
      <select
        aria-label={title}
        value={value}
        onChange={(event) => {
          ctx.setValue(id, event.currentTarget.value);
          onChange?.(event.currentTarget.value);
        }}
      >
        {children}
      </select>
    </label>
  );
};

Form.Dropdown.Item = function DropdownItem({ value, title }: { value: string; title: string }) {
  return <option value={value}>{title}</option>;
};

export function List({
  children,
  actions,
  searchText = "",
  onSearchTextChange,
  searchBarPlaceholder,
  searchBarAccessory,
  navigationTitle,
  isLoading,
}: PropsWithChildren<{
  actions?: ReactNode;
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
  searchBarPlaceholder?: string;
  searchBarAccessory?: ReactNode;
  navigationTitle?: string;
  isLoading?: boolean;
  filtering?: boolean;
}>) {
  return (
    <section aria-label={navigationTitle ?? "List"}>
      {isLoading ? <span>Loading</span> : null}
      {onSearchTextChange ? (
        <input
          aria-label={searchBarPlaceholder ?? "Search"}
          placeholder={searchBarPlaceholder}
          value={searchText}
          onChange={(event) => onSearchTextChange(event.currentTarget.value)}
        />
      ) : null}
      {searchBarAccessory}
      {children}
      {renderActions(actions)}
    </section>
  );
}

List.Item = function ListItem({
  title,
  subtitle,
  actions,
  accessories,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  accessories?: { tag?: string; tooltip?: string }[];
  icon?: unknown;
  id?: string;
}) {
  return (
    <article>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {accessories?.map((accessory, index) => (
        <span key={`${accessory.tag ?? accessory.tooltip ?? "accessory"}-${index}`}>
          {accessory.tag ?? accessory.tooltip}
        </span>
      ))}
      {renderActions(actions)}
    </article>
  );
};

List.EmptyView = function EmptyView({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: unknown;
}) {
  return (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {renderActions(actions)}
    </div>
  );
};

List.Dropdown = function ListDropdown({
  value,
  onChange,
  children,
  tooltip,
}: PropsWithChildren<{
  value: string;
  onChange: (value: string) => void;
  tooltip?: string;
  storeValue?: boolean;
}>) {
  return (
    <label>
      <span>{tooltip ?? "Dropdown"}</span>
      <select aria-label={tooltip ?? "Dropdown"} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {children}
      </select>
    </label>
  );
};

List.Dropdown.Item = function ListDropdownItem({ value, title }: { value: string; title: string }) {
  return <option value={value}>{title}</option>;
};

export function MenuBarExtra({
  children,
  tooltip,
  isLoading,
}: PropsWithChildren<{ tooltip?: string; isLoading?: boolean; icon?: unknown }>) {
  return (
    <section aria-label={tooltip ?? "Menu Bar"}>
      {isLoading ? <span>Loading</span> : null}
      {children}
    </section>
  );
}

MenuBarExtra.Item = function MenuBarItem({
  title,
  subtitle,
  tooltip,
  onAction,
}: {
  title: string;
  subtitle?: string;
  tooltip?: string;
  onAction?: () => void;
  icon?: unknown;
}) {
  return (
    <button aria-label={tooltip ?? title} type="button" onClick={() => onAction?.()}>
      {title}
      {subtitle ? ` ${subtitle}` : ""}
    </button>
  );
};

MenuBarExtra.Separator = function MenuBarSeparator() {
  return <hr />;
};

export function setPreferenceValues(values: Record<string, unknown>): void {
  Object.keys(preferencesState).forEach((key) => delete preferencesState[key]);
  Object.assign(preferencesState, values);
}

export function setConfirmAlertResult(value: boolean): void {
  confirmAlertResult = value;
}

export function setNavigationMocks({
  push,
  pop,
}: {
  push?: typeof navigationPushMock;
  pop?: typeof navigationPopMock;
}): void {
  if (push) {
    navigationPushMock.mockImplementation(push);
  }
  if (pop) {
    navigationPopMock.mockImplementation(pop);
  }
}

export function seedLocalStorage(key: string, value: string): void {
  localStorageState.set(key, value);
}

export function resetRaycastApiMocks(): void {
  Object.keys(preferencesState).forEach((key) => delete preferencesState[key]);
  localStorageState.clear();
  confirmAlertResult = true;
  navigationPushMock.mockReset();
  navigationPopMock.mockReset();
  showToastMock.mockReset();
  showToastMock.mockImplementation(async (options?: unknown) => options);
  confirmAlertMock.mockReset();
  confirmAlertMock.mockImplementation(async () => confirmAlertResult);
  openExtensionPreferencesMock.mockReset();
  popToRootMock.mockReset();
  popToRootMock.mockImplementation(async () => undefined);
  launchCommandMock.mockReset();
  launchCommandMock.mockImplementation(async () => undefined);
}

export const Alert = {
  ActionStyle: {
    Destructive: "destructive",
  },
};

export const Icon = new Proxy(
  {},
  {
    get: (_target, property) => String(property),
  },
);

export const Keyboard = {
  Shortcut: {
    Common: {
      Open: { modifiers: ["cmd"], key: "o" },
    },
  },
};

export const LaunchType = {
  UserInitiated: "user-initiated",
};

export const LocalStorage = {
  setItem: async (key: string, value: string) => {
    localStorageState.set(key, value);
  },
  getItem: async (key: string) => localStorageState.get(key) ?? null,
};

export const OAuth = {
  RedirectMethod: {
    AppURI: "AppURI",
  },
  PKCEClient: class PKCEClient {
    constructor(public readonly options: Record<string, unknown>) {}
  },
};

export const Toast = {
  Style: {
    Failure: "failure",
    Success: "success",
  },
};

export const confirmAlert = confirmAlertMock;
export const launchCommand = launchCommandMock;
export const openExtensionPreferences = openExtensionPreferencesMock;
export const popToRoot = popToRootMock;
export const showToast = showToastMock;

export function getPreferenceValues<T extends Record<string, unknown>>(): T {
  return preferencesState as T;
}

export function useNavigation() {
  return {
    push: navigationPushMock,
    pop: navigationPopMock,
  };
}

export const raycastApiMock = {
  Action,
  ActionPanel,
  Alert,
  Detail,
  Form,
  Icon,
  Keyboard,
  LaunchType,
  List,
  LocalStorage,
  MenuBarExtra,
  OAuth,
  Toast,
  confirmAlert,
  getPreferenceValues,
  launchCommand,
  openExtensionPreferences,
  popToRoot,
  showToast,
  useNavigation,
};
