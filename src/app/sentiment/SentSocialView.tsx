import type { SocialIntel } from "@/data/news";
import { Panel } from "@/components/ui/Panel";
import { fmtSigned } from "@/lib/format";

export function SentSocialView({ data }: { data: SocialIntel & { source: string } }) {
  return <div className="space-y-2">
    <Panel title="Observed Social Mood" code="SENT-3" right={<span className="text-3xs text-term-text-dim">{data.source}</span>}>
      <div className="flex flex-wrap gap-4 p-3 text-2xs text-term-text-dim">
        {data.platforms.map(p => <div key={p.name}>{p.name}: {p.posts.toLocaleString()} observed posts · keyword sentiment {fmtSigned(p.sentiment, 2)}</div>)}
      </div>
    </Panel>
    {([["Tickers", data.tickers], ["Sectors", data.sectors], ["Themes", data.themes]] as const).map(([title, rows]) =>
      <Panel key={title} title={title}>
        {!rows.length ? <p className="p-3 text-2xs text-term-text-dim">No data — no observed {title.toLowerCase()} rows.</p> :
          <div className="overflow-x-auto"><table aria-label={`Observed social ${title.toLowerCase()}`} className="w-full whitespace-nowrap text-2xs tnum">
            <thead><tr>{[title, "Mentions", "Relative attention proxy", "Keyword sentiment"].map(c => <th key={c} scope="col" className="border-b border-term-border px-3 py-2 text-left text-term-text-dim">{c}</th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.label} className="border-b border-term-border-soft text-term-text">
              <th scope="row" className="px-3 py-1 text-left font-normal">{r.label}</th><td className="px-3 py-1">{r.mentions}</td><td className="px-3 py-1">{r.velocity}%</td><td className="px-3 py-1">{fmtSigned(r.sentiment, 2)}</td>
            </tr>)}</tbody>
          </table></div>}
      </Panel>)}
    <p className="text-3xs text-term-text-mute">Keyword sentiment and relative attention are derived from observed posts. True historical mention velocity, StockTwits sentiment and sector tagging have no source here.</p>
  </div>;
}
