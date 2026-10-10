/** NBER US recession bands (peak → trough), for macro chart shading. */
export interface RecessionBand {
  start: string; // ISO
  end: string;
  label: string;
}

export const US_RECESSIONS: RecessionBand[] = [
  { start: "1990-07-01", end: "1991-03-31", label: "1990–91" },
  { start: "2001-03-01", end: "2001-11-30", label: "2001" },
  { start: "2007-12-01", end: "2009-06-30", label: "GFC" },
  { start: "2020-02-01", end: "2020-04-30", label: "COVID" },
];
