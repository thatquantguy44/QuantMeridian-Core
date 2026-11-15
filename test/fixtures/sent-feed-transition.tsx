import { Component, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { useFeed } from "../../src/app/sentiment/useSentFeeds";

const legacyParser = (body: unknown) => Array.isArray(body) ? body : null;
const macroParser = (body: unknown) => body && typeof body === "object" && "series" in body ? body as { series: { id: string }[] } : null;
class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <p role="alert">{this.state.error}</p> : this.props.children; }
}
function Probe() {
  const [modern, setModern] = useState(false);
  const sameUrl = new URLSearchParams(location.search).has("sameUrl");
  const url = modern || sameUrl ? "/api/sent-test/macro" : "/api/sent-test/legacy";
  const feed = useFeed<unknown>(url, modern ? macroParser : legacyParser, 0);
  // Reproduce the real consumer's contract: old arrays cannot reach the new view,
  // even for the render before effects clear/refetch state after a hot update.
  const label = !feed.data ? "Loading" : modern
    ? (feed.data as { series: { id: string }[] }).series.find(s => s.id === "VIXCLS")!.id
    : (feed.data as string[])[0];
  return <><button onClick={() => setModern(true)}>Switch to macro contract</button><output>{label}</output></>;
}
createRoot(document.getElementById("root")!).render(<Boundary><Probe /></Boundary>);
