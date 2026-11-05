import { faker } from "@faker-js/faker";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type DocType = "assistance_application" | "hardship_letter" | "pay_stub" | "bank_statement" | "other";

interface TruthDocument {
  docType: DocType;
  pageStart: number;
  pageEnd: number;
  fields: Record<string, string | number | boolean>;
  plantedErrors: string[];
}

interface PacketTruth {
  packetId: string;
  borrowerName: string;
  loanNumber: string;
  documents: TruthDocument[];
}

const OUT_DIR = join(import.meta.dirname, "out");
const PAGE_SIZE: [number, number] = [612, 792]; // US letter, points

async function newPage(pdf: PDFDocument) {
  const page = pdf.addPage(PAGE_SIZE);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  return { page, font };
}

function drawLines(page: import("pdf-lib").PDFPage, font: import("pdf-lib").PDFFont, lines: string[]) {
  let y = 740;
  for (const line of lines) {
    page.drawText(line, { x: 56, y, size: 11, font, color: rgb(0, 0, 0) });
    y -= 20;
  }
}

async function renderAssistanceApplication(pdf: PDFDocument, truth: PacketTruth) {
  const { page, font } = await newPage(pdf);
  const fields = {
    borrower_name: truth.borrowerName,
    loan_number: truth.loanNumber,
    property_address: faker.location.streetAddress({ useFullAddress: true }),
    monthly_income: faker.number.int({ min: 3000, max: 9000 }),
    hardship_reason: faker.helpers.arrayElement(["job loss", "medical", "divorce", "reduced hours"]),
  };
  drawLines(page, font, [
    "BORROWER ASSISTANCE APPLICATION",
    "",
    `Borrower name: ${fields.borrower_name}`,
    `Loan number: ${fields.loan_number}`,
    `Property address: ${fields.property_address}`,
    `Monthly income: $${fields.monthly_income}`,
    `Hardship reason: ${fields.hardship_reason}`,
  ]);
  return { docType: "assistance_application" as const, fields, plantedErrors: [] as string[], pageCount: 1 };
}

async function renderHardshipLetter(pdf: PDFDocument, truth: PacketTruth, opts: { misspellName?: boolean }) {
  const { page, font } = await newPage(pdf);
  const plantedErrors: string[] = [];
  let borrowerName = truth.borrowerName;
  if (opts.misspellName) {
    borrowerName = borrowerName.replace(/^./, (c) => c.toLowerCase());
    plantedErrors.push("name_mismatch");
  }
  const fields = {
    borrower_name: borrowerName,
    hardship_type: faker.helpers.arrayElement(["job loss", "medical", "death in family"]),
    hardship_start_date: faker.date.past({ years: 1 }).toISOString().slice(0, 10),
    signed: true,
  };
  drawLines(page, font, [
    "To whom it may concern,",
    "",
    `My name is ${fields.borrower_name} and I am writing to explain my hardship.`,
    `Hardship type: ${fields.hardship_type}`,
    `Started: ${fields.hardship_start_date}`,
    "",
    `Signed, ${fields.borrower_name}`,
  ]);
  return { docType: "hardship_letter" as const, fields, plantedErrors, pageCount: 1 };
}

async function renderPayStub(pdf: PDFDocument, truth: PacketTruth, opts: { netExceedsGross?: boolean }) {
  const { page, font } = await newPage(pdf);
  const plantedErrors: string[] = [];
  const gross = faker.number.int({ min: 2500, max: 6000 });
  let net = Math.round(gross * 0.75);
  if (opts.netExceedsGross) {
    net = gross + 200;
    plantedErrors.push("net_exceeds_gross");
  }
  const fields = {
    employee_name: truth.borrowerName,
    pay_period_end: faker.date.recent({ days: 30 }).toISOString().slice(0, 10),
    gross_pay: gross,
    net_pay: net,
  };
  drawLines(page, font, [
    "EARNINGS STATEMENT",
    "",
    `Employee name: ${fields.employee_name}`,
    `Pay period end: ${fields.pay_period_end}`,
    `Gross pay: $${fields.gross_pay}`,
    `Net pay: $${fields.net_pay}`,
  ]);
  return { docType: "pay_stub" as const, fields, plantedErrors, pageCount: 1 };
}

async function renderBankStatement(pdf: PDFDocument, truth: PacketTruth) {
  const { page, font } = await newPage(pdf);
  const fields = {
    account_holder: truth.borrowerName,
    statement_end_date: faker.date.recent({ days: 30 }).toISOString().slice(0, 10),
    ending_balance: faker.number.int({ min: 100, max: 15000 }),
  };
  drawLines(page, font, [
    "BANK STATEMENT",
    "",
    `Account holder: ${fields.account_holder}`,
    `Statement end date: ${fields.statement_end_date}`,
    `Ending balance: $${fields.ending_balance}`,
  ]);
  return { docType: "bank_statement" as const, fields, plantedErrors: [] as string[], pageCount: 1 };
}

async function renderStrayOther(pdf: PDFDocument) {
  const { page, font } = await newPage(pdf);
  drawLines(page, font, ["UTILITY BILL", "", "This document should classify as 'other'."]);
  return { docType: "other" as const, fields: {}, plantedErrors: ["stray_other_document"], pageCount: 1 };
}

/**
 * TODO: rasterize a page to PNG and apply slight rotation, blur, and noise
 * with sharp so it has no text layer (simulates a scanned page). Needs a PDF
 * rendering backend (e.g. pdfjs-dist + node canvas) that isn't wired up yet.
 */
async function scanPage(): Promise<never> {
  throw new Error("scanPage not implemented yet");
}
void scanPage;

async function generatePacket(index: number): Promise<{ pdfBytes: Uint8Array; truth: PacketTruth }> {
  const packetId = `packet-${String(index).padStart(3, "0")}`;
  const truth: PacketTruth = {
    packetId,
    borrowerName: faker.person.fullName(),
    loanNumber: faker.finance.accountNumber(10),
    documents: [],
  };

  const pdf = await PDFDocument.create();

  const plantNameMismatch = index % 7 === 0;
  const plantNetError = index % 11 === 0;
  const plantMissingBankMonth = index % 5 === 0;
  const plantStrayOther = index % 9 === 0;

  const renderers: Array<() => Promise<{ docType: DocType; fields: Record<string, unknown>; plantedErrors: string[]; pageCount: number }>> = [
    () => renderAssistanceApplication(pdf, truth),
    () => renderHardshipLetter(pdf, truth, { misspellName: plantNameMismatch }),
    () => renderPayStub(pdf, truth, {}),
    () => renderPayStub(pdf, truth, { netExceedsGross: plantNetError }),
    () => renderBankStatement(pdf, truth),
  ];

  if (!plantMissingBankMonth) {
    renderers.push(() => renderBankStatement(pdf, truth));
  }
  if (plantStrayOther) {
    renderers.push(() => renderStrayOther(pdf));
  }

  // Render in a random (shuffled) order, as the real packets arrive shuffled.
  const shuffled = faker.helpers.shuffle(renderers);

  let pageCursor = 1;
  for (const render of shuffled) {
    const result = await render();
    truth.documents.push({
      docType: result.docType,
      pageStart: pageCursor,
      pageEnd: pageCursor + result.pageCount - 1,
      fields: result.fields as Record<string, string | number | boolean>,
      plantedErrors: result.plantedErrors,
    });
    pageCursor += result.pageCount;
  }

  return { pdfBytes: await pdf.save(), truth };
}

async function main() {
  const count = Number(process.argv[2] ?? 50);
  mkdirSync(OUT_DIR, { recursive: true });

  for (let i = 1; i <= count; i++) {
    const { pdfBytes, truth } = await generatePacket(i);
    writeFileSync(join(OUT_DIR, `${truth.packetId}.pdf`), pdfBytes);
    writeFileSync(join(OUT_DIR, `${truth.packetId}.truth.json`), JSON.stringify(truth, null, 2));
    console.log(`generated ${truth.packetId} (${truth.documents.length} documents)`);
  }

  console.log(`done. wrote ${count} packets to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
