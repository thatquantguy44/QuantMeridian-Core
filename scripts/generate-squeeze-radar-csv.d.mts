export interface SqueezeRadarGeneratorOptions {
  outputDir?: string;
  manifestPath?: string;
  scenarioManifest?: Record<string, unknown>;
  scenarioId?: string;
  seed?: number;
  generatedAt?: string;
  writeContracts?: boolean;
}

export interface SqueezeRadarGeneratorSummary {
  outputDir: string;
  scenarioId: string;
  seed: number;
  generatedAt: string;
  generatorVersion: string;
  scenarioManifestId: string;
  scenarioManifestVersion: string;
  scenarioManifestSha256: string;
  appliedFaultIds: string[];
  fileCount: number;
  metadataFileCount: number;
  rowCounts: Record<string, number>;
}

export const DEFAULT_SYNTHETIC_GENERATOR_OPTIONS: Readonly<{
  outputDir: string;
  manifestPath: string;
  writeContracts: false;
}>;

export function generateSqueezeRadarCsv(
  options?: SqueezeRadarGeneratorOptions,
): Promise<SqueezeRadarGeneratorSummary>;

export function parseSqueezeGeneratorArgs(
  args: string[],
  cwd?: string,
): { help: boolean; options: SqueezeRadarGeneratorOptions & { outputDir: string; writeContracts: boolean } };
