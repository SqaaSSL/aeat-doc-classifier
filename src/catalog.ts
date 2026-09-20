import { readFileSync } from 'node:fs';
import type { AccountDefinition, ModelDefinition } from './types.js';

const forms = JSON.parse(readFileSync(new URL('../data/aeat-models.json', import.meta.url), 'utf8')) as { version: string; models: ModelDefinition[] };
const accounts = JSON.parse(readFileSync(new URL('../data/pgc-accounts.json', import.meta.url), 'utf8')) as { version: string; accounts: AccountDefinition[] };

export const catalogVersion = `${forms.version}/${accounts.version}`;
export const aeatModels: readonly ModelDefinition[] = forms.models;
export const pgcAccounts: readonly AccountDefinition[] = accounts.accounts;

export const pageKinds = {
  tax_form: 'A tax return/self-assessment or census declaration form itself. A header with model number and a list of field labels is a blank form even without filled values. Includes form excerpts. Not explanatory prose giving completion instructions, a notification, invoice or receipt.',
  filing_receipt: 'Official acknowledgement of tax filing: justificante de presentación, registro, CSV, expediente, fecha de presentación. Not just a bank debit.',
  instructions: 'Explanatory prose giving instructions on completing a form, a manual or worked example. Needs actual explanatory language such as deberá consignar or instrucciones; a bare form heading and field labels are a form, not instructions.',
  invoice: 'Ordinary invoice for goods/services, factura, named supplier/customer and transaction details. An excerpt can omit legal fields. Not rectifying or explicitly simplified/ticket.',
  credit_note: 'Rectifying invoice, factura rectificativa, abono or credit note correcting another invoice.',
  simplified_invoice: 'Factura simplificada or commercial receipt/ticket for goods/services; not a filing acknowledgement.',
  payroll: 'Employee payslip, nómina, wages, deductions, net pay; not a professional invoice.',
  social_security: 'TGSS document, RLC, RNT, contribution receipt or RETA contribution; not an AEAT return.',
  bank_statement: 'Bank account movements, bank statement, bank transfer/debit advice or bank payment confirmation.',
  accounting_report: 'Balance sheet, income statement, general ledger, trial balance or accounting books; not a tax form containing those figures.',
  notification: 'Tax notice, request for information, proposed assessment, sanction or collection notice; mere references to models do not make it a return.',
  other: 'Other, unrelated, mixed, illegible or insufficiently identifiable document.',
} as const;

export const jurisdictions = {
  aeat: 'Spanish national tax form, instructions, notice or filing receipt headed Agencia Tributaria, AEAT, or Agencia Estatal de Administración Tributaria. Agencia Tributaria alone is the national name unless a specific regional/foral/Canary qualifier is printed. Classify the stated authority; no authenticity check is requested. Commercial invoices are not AEAT documents.',
  foral: 'Issued by a Basque provincial Hacienda Foral (Bizkaia, Gipuzkoa, Álava/Araba) or Hacienda Foral de Navarra; even if its form number matches AEAT.',
  regional: 'Issued by a Spanish autonomous-community or local tax authority, e.g. ATC Catalunya, Comunidad de Madrid; not national AEAT or Canary IGIC authority.',
  canary: 'Agencia Tributaria Canaria / IGIC / AIEM regional tax document; not AEAT IVA.',
  foreign: 'Tax return/notice from a non-Spanish tax authority such as IRS, HMRC or Portuguese AT.',
  not_applicable: 'Commercial, bank, payroll, social-security or accounting document that is not issued by a tax authority or a tax return. Includes foreign supplier invoices.',
  unknown: 'Tax authority cannot be identified, conflicting authorities, or insufficient evidence.',
} as const;
