import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export type FieldType = "string" | "date" | "money" | "boolean";

export interface TemplateField {
  name: string;
  type: FieldType;
  prompt: string;
  weight: number;
}

export interface DocumentTemplate {
  type: string;
  description: string;
  required_per_packet: number;
  fields: TemplateField[];
  checks: string[];
}

const TEMPLATES_DIR = join(import.meta.dirname, "../../../templates");

export function loadTemplate(type: string): DocumentTemplate {
  const raw = readFileSync(join(TEMPLATES_DIR, `${type}.yaml`), "utf8");
  return parse(raw) as DocumentTemplate;
}

export function loadAllTemplates(): DocumentTemplate[] {
  return readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => parse(readFileSync(join(TEMPLATES_DIR, f), "utf8")) as DocumentTemplate);
}
