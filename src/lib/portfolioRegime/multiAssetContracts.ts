export const PORA_ASSETS = ["SPY", "AGG", "ACWI", "BIL"] as const;
export type PoraAsset = typeof PORA_ASSETS[number];
export interface MultiAssetPreview {
  source: "DB"; asOfDate: string; checkedAt: string; firstDate: string; lastDate: string; sessionCount: number; returnCount: number;
  assets: { id: PoraAsset; latestDate: string; futureCount: number; lastIngestedAt: string; totalChange: number; returns: { date: string; value: number }[] }[];
}
