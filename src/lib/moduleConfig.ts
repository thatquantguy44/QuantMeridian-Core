import config from "../../settings/modules.config.json";

interface ModuleEntry {
  enabled: boolean;
  label: string;
}

const modules: Record<string, ModuleEntry> = config.modules;

export function isModuleEnabled(code: string): boolean {
  const entry = modules[code];
  return entry ? entry.enabled : true;
}

export function getEnabledModules(): string[] {
  return Object.entries(modules)
    .filter(([, m]) => m.enabled)
    .map(([code]) => code);
}

export function getDisabledModules(): string[] {
  return Object.entries(modules)
    .filter(([, m]) => !m.enabled)
    .map(([code]) => code);
}
