import { readFile } from "node:fs/promises";
import process from "node:process";

import { validateAgentSkillsPin } from "./lib/agent-skills-pin.mjs";

const pinPath = "contracts/agent/agent-skills.pin.json";

const pin = JSON.parse(await readFile(pinPath, "utf8"));
const errors = await validateAgentSkillsPin(pin);
if (errors.length > 0) {
  for (const error of errors) console.error(`Agent Skills pin check FAILED — ${error}`);
  process.exit(1);
}
console.log(
  `Agent Skills full-repository pin PASSED — ${pin.source.repository}@${pin.source.commit.slice(0, 12)} (${pin.files.length} paths, ${pin.skills.length} skills).`,
);
