import { useRef, type ReactNode } from "react";
import { Panel } from "@/components/ui/Panel";

interface WorkspaceTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function WorkspaceTabs({ id, label, tabs, value, onChange }: {
  id: string;
  label: string;
  tabs: WorkspaceTab[];
  value: string;
  onChange: (value: string) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="min-w-0">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-term-border pb-2">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => { buttons.current[index] = element; }}
            id={`${id}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            aria-controls={`${id}-panel-${tab.id}`}
            tabIndex={value === tab.id ? 0 : -1}
            className={`term-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber ${value === tab.id ? "term-btn-active" : ""}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              onChange(tabs[next].id);
              buttons.current[next]?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${id}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab.id}`}
          hidden={value !== tab.id}
          tabIndex={0}
          className="pt-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

export function WorkspaceStatus({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-1 divide-y divide-term-border border-b border-term-border bg-term-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-3 py-2">
          <dt className="text-2xs uppercase tracking-wide text-term-text-dim">{item.label}</dt>
          <dd className="mt-1 text-xs text-term-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyWorkspace({ title, description, columns, note }: {
  title: string;
  description: string;
  columns: string[];
  note?: string;
}) {
  return (
    <Panel title={title} resizable={false}>
      <div className="overflow-x-auto">
        <table className="text-left text-2xs">
          <caption className="sr-only">{title} — empty workspace</caption>
          <thead className="border-b border-term-border bg-term-panel-2 text-term-text-dim">
            <tr>{columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>)}</tr>
          </thead>
          <tbody />
        </table>
      </div>
      <div className="px-3 py-8">
        <h2 className="text-sm font-medium text-term-text">{title}</h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-term-text-dim">{description}</p>
        {note && <p className="mt-3 max-w-xl text-2xs leading-relaxed text-term-text-dim">{note}</p>}
      </div>
    </Panel>
  );
}
