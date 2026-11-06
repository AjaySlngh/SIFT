import { describe, expect, it } from "vitest";
import { scoreField, scoreDocument, routeDocument } from "../src/scoring";
import type { DocumentTemplate } from "../src/templates";

describe("scoreField", () => {
  it("zeroes out on parse failure", () => {
    const result = scoreField({
      field: { name: "net_pay", value: "oops", modelConfidence: 0.9 },
      parseFailed: true,
      ruleFailed: false,
      crossDocMismatch: false,
    });
    expect(result.score).toBe(0);
    expect(result.failedChecks).toEqual(["parse_failure"]);
  });

  it("applies rule, cross-doc, and no-evidence multipliers", () => {
    const result = scoreField({
      field: { name: "gross_pay", value: 1000, modelConfidence: 1 },
      parseFailed: false,
      ruleFailed: true,
      crossDocMismatch: true,
    });
    expect(result.score).toBeCloseTo(1 * 0.5 * 0.6 * 0.7, 5);
    expect(result.failedChecks).toEqual(["rule_failure", "cross_doc_mismatch", "no_evidence"]);
  });

  it("passes cleanly when evidence is present and checks hold", () => {
    const result = scoreField({
      field: {
        name: "gross_pay",
        value: 1000,
        modelConfidence: 0.95,
        sourcePage: 2,
        evidence: "Gross pay: $1,000.00",
      },
      parseFailed: false,
      ruleFailed: false,
      crossDocMismatch: false,
    });
    expect(result.score).toBe(0.95);
    expect(result.failedChecks).toEqual([]);
  });
});

describe("scoreDocument", () => {
  const template: DocumentTemplate = {
    type: "pay_stub",
    description: "",
    required_per_packet: 2,
    fields: [
      { name: "gross_pay", type: "money", prompt: "", weight: 3 },
      { name: "net_pay", type: "money", prompt: "", weight: 2 },
    ],
    checks: [],
  };

  it("computes a weighted average using template weights", () => {
    const result = scoreDocument(template, [
      { name: "gross_pay", score: 1, failedChecks: [] },
      { name: "net_pay", score: 0.5, failedChecks: [] },
    ]);
    // (1*3 + 0.5*2) / (3+2) = 4/5 = 0.8
    expect(result.score).toBeCloseTo(0.8, 5);
  });
});

describe("routeDocument", () => {
  it("sends low classification confidence to reclassify review", () => {
    const decision = routeDocument({
      classConfidence: 0.5,
      docType: "pay_stub",
      fieldScores: [],
      requiredFieldsPresent: true,
    });
    expect(decision).toEqual({ outcome: "review", reason: "reclassify" });
  });

  it("sends 'other' type to reclassify review regardless of confidence", () => {
    const decision = routeDocument({
      classConfidence: 0.99,
      docType: "other",
      fieldScores: [],
      requiredFieldsPresent: true,
    });
    expect(decision).toEqual({ outcome: "review", reason: "reclassify" });
  });

  it("sends weak fields to review", () => {
    const decision = routeDocument({
      classConfidence: 0.9,
      docType: "pay_stub",
      fieldScores: [{ name: "net_pay", score: 0.6, failedChecks: [] }],
      requiredFieldsPresent: true,
    });
    expect(decision).toEqual({ outcome: "review", reason: "weak_fields" });
  });

  it("auto-accepts strong fields outside the spot-check sample", () => {
    const decision = routeDocument({
      classConfidence: 0.9,
      docType: "pay_stub",
      fieldScores: [{ name: "net_pay", score: 0.95, failedChecks: [] }],
      requiredFieldsPresent: true,
      random: () => 0.99,
    });
    expect(decision).toEqual({ outcome: "auto_accepted" });
  });

  it("spot-checks a random slice of auto-accepted documents", () => {
    const decision = routeDocument({
      classConfidence: 0.9,
      docType: "pay_stub",
      fieldScores: [{ name: "net_pay", score: 0.95, failedChecks: [] }],
      requiredFieldsPresent: true,
      random: () => 0.01,
    });
    expect(decision).toEqual({ outcome: "spot_check" });
  });
});
