export interface IncomeStatement {
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  grossMargin: number;
  researchAndDevelopmentExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  operatingIncome: number;
  operatingMargin: number;
  interestIncome: number;
  interestExpense: number;
  netInterestIncome: number;
  depreciationAndAmortization: number;
  ebitda: number;
  incomeBeforeTax: number;
  incomeTaxExpense: number;
  netIncome: number;
  netMargin: number;
  epsDiluted: number;
  weightedAverageSharesDiluted: number;
}

export interface BalanceSheet {
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  accountsReceivables: number;
  inventory: number;
  totalCurrentAssets: number;
  propertyPlantEquipmentNet: number;
  goodwill: number;
  totalAssets: number;
  accountPayables: number;
  accruedExpenses: number;
  shortTermDebt: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  longTermDebt: number;
  capitalLeaseObligationsNonCurrent: number;
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  retainedEarnings: number;
  totalStockholdersEquity: number;
  totalDebt: number;
  netDebt: number;
}

export interface CashFlowStatement {
  netIncome: number;
  depreciationAndAmortization: number;
  stockBasedCompensation: number;
  changeInInventory: number;
  changeInAccountsPayable: number;
  changeInWorkingCapital: number;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  acquisitionsNet: number;
  commonStockRepurchased: number;
  commonDividendsPaid: number;
  netCashProvidedByFinancingActivities: number;
  interestPaid: number;
  incomeTaxesPaid: number;
}

export interface DerivedRatios {
  inventoryTurnover: number;
  daysInventoryOutstanding: number;
  cashConversionCycleDays: number;
  currentRatio: number;
  returnOnEquity: number;
  dividendPayoutRatio: number;
  fcfMargin: number;
}

export interface YearFinancials {
  fiscal_year: string; // "FY2022"
  income_statement: IncomeStatement;
  balance_sheet: BalanceSheet;
  cash_flow_statement: CashFlowStatement;
  derived_ratios: DerivedRatios;
}

export interface Challenge {
  slug?: string; // catalog 형식 (TICKER-FYxxxx)
  date?: string; // legacy daily 형식
  challenge: {
    fiscal_year: string;
    fiscal_year_end_hint: string;
    reported_currency: string;
    industry_options: string[];
    company_pool: string[];
    financials: {
      income_statement: IncomeStatement;
      balance_sheet: BalanceSheet;
      cash_flow_statement: CashFlowStatement;
    };
    derived_ratios: DerivedRatios;
    // 다년도 트렌드 — 오래된 → 최신 순. 최신 항목은 위 financials와 동일한 스냅샷.
    financials_history?: YearFinancials[];
  };
  answer: {
    company: string;
    ticker: string;
    industry: string;
  };
  scoring: {
    industry_distance: Record<string, number>;
    company_pool_distractor_rationale: Record<string, string>;
  };
  narrative: string;
  metadata: Record<string, unknown>;
}
