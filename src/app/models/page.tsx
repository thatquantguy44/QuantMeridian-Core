import { BookOpen, Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Tag } from "@/components/ui/Panel";

const NEXT_STEPS = [
  "Define the versioned model-registry JSON Schema and stable model IDs.",
  "Generate the human-readable dictionary from the reviewed registry.",
  "Render searchable model cards, ownership, evidence, versions, and limitations here.",
];

export default function ModelsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        code="MDLS"
        title="Model Dictionary"
        desc="Terminal-wide model catalog · methodology · governance"
        right={<Tag tone="amber">PLACEHOLDER</Tag>}
        showStreaming={false}
      />

      <main aria-label="Model Dictionary placeholder" className="grid flex-1 gap-2 p-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Panel title="Dictionary foundation" code="CATALOG" accent resizable={false}>
          <div className="space-y-4 p-4 text-xs leading-relaxed text-term-text-dim">
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-term-amber" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold text-term-text">The catalog starts in documentation</h2>
                <p className="mt-1">
                  The initial master index records models, scoring rules, optimizers, simulations, and configured
                  language-model runtimes without implying that every entry is trained, live, or production-approved.
                </p>
              </div>
            </div>

            <div className="border border-term-border bg-term-panel-2 p-3">
              <div className="term-label">Canonical document</div>
              <code className="mt-1 block break-all text-term-amber">docs/MODEL_DICTIONARY.MD</code>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="border border-term-border p-3">
                <Database className="mb-2 h-4 w-4 text-term-blue" aria-hidden />
                <h3 className="font-semibold text-term-text">Registry contract</h3>
                <p className="mt-1">Planned: one machine-readable source for identity, versions, inputs, outputs, and links.</p>
              </div>
              <div className="border border-term-border p-3">
                <ShieldCheck className="mb-2 h-4 w-4 text-term-up" aria-hidden />
                <h3 className="font-semibold text-term-text">Evidence, not decoration</h3>
                <p className="mt-1">Implementation, provenance, validation, and approval remain separate facts.</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Planned MDLS surface" code="NEXT" resizable={false}>
          <div className="p-4">
            <ol className="space-y-3 text-xs text-term-text-dim">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 border-b border-term-border-soft pb-3 last:border-0 last:pb-0">
                  <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center border border-term-amber/50 text-3xs font-bold text-term-amber">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-term-border pt-3 text-3xs uppercase tracking-wide text-term-text-mute">
              No model results or operational status are loaded on this placeholder page.
            </p>
          </div>
        </Panel>
      </main>
    </div>
  );
}
