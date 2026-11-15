import { describe, expect, it } from "vitest";
import { decodeVolatility } from "./useVolatility";
import { buildVolatility, assessVolatility, denyVolatilityMetrics } from "../server/fx/volatility";
import { captureRows } from "../server/fx/snapshot";
import { volatilityRows, volatilityAt as at } from "../../../test/fixtures/fx-volatility";
function data() { const {volatility}=buildVolatility(captureRows(volatilityRows(),1024),at,at,at);
  return {volatility,pairs:volatility.pairs,assessedAt:at,nextCheckAt:volatility.freshness.nextCheckAt,error:null,retained:null}; }
describe("volatility response boundary",()=>{
  it("accepts complete and separately stale captures without promoting captured values",()=>{
    const d=data();expect(decodeVolatility(d)).toEqual(d);
    const stale={...d,pairs:assessVolatility(d.volatility,"2026-11-02T16:00:00.000Z"),assessedAt:"2026-11-02T16:00:00.000Z"};
    expect(decodeVolatility(stale).pairs[0].metrics[4].dailySigma).toBeNull();
    expect(decodeVolatility(stale).pairs[0].historicalMetrics[4].annualizedSigma).toBeGreaterThan(0);
  });
  it("rejects wrong versions, malformed values, compressed schedules and mismatched scaling",()=>{
    for (const mutate of [(d:ReturnType<typeof data>)=>{d.volatility.methodVersion="other" as never;},
      (d:ReturnType<typeof data>)=>{d.pairs[0].metrics[0].dailySigma=NaN;},
      (d:ReturnType<typeof data>)=>{d.pairs[0].points.pop();},
      (d:ReturnType<typeof data>)=>{d.pairs[0].metrics[0].annualizedSigma=999;}]) {
      const d=data();mutate(d);expect(()=>decodeVolatility(d)).toThrow();
    }
    const d=data(); d.pairs[0].historicalMetrics[0].annualizedSigma=999; expect(()=>decodeVolatility(d)).toThrow();
  });
  it("allows verified retained evidence only with blocked current estimates",()=>{
    const d=data(),error={code:"SOURCE_UNAVAILABLE",message:"Unavailable"};
    const retained={volatilityId:d.volatility.volatilityId,cutoffAt:at,schedule:d.volatility.schedule,evidence:d.volatility.evidence};
    const fail={...d,volatility:null,retained,error,pairs:denyVolatilityMetrics(d.pairs,error)};
    expect(decodeVolatility(fail).retained).toEqual(retained);
    expect(()=>decodeVolatility({...fail,pairs:d.pairs})).toThrow();
  });
});
