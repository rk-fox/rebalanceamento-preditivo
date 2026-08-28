export interface HistorySnapshot {
  id: string;
  date: string;
  depositAmount: number;
  totalEquity: number;
}

export const HISTORY_STORAGE_KEY = 'pe_portfolio_history';

export const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MONTH_MAP: Record<string, number> = {
  // Portuguese short
  'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
  'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11,
  // Portuguese full
  'janeiro': 0, 'fevereiro': 1, 'marco': 2, 'março': 2, 'abril': 3,
  'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8,
  'outubro': 9, 'novembro': 10, 'dezembro': 11,
  // English short & full
  'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'october': 9, 'dec': 11, 'december': 11, 'feb': 1, 'february': 1,
  'apr': 3, 'april': 3, 'may': 4, 'june': 5, 'july': 6
};

/**
 * Robustly parses any date string, month-year representation, or Date object
 * into a standardized Portuguese Month-Year key (e.g., "Ago 2026") and timestamp.
 */
export function parseToMonthYear(input?: string | Date): { key: string; time: number } {
  if (!input) {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return { key: `${PT_MONTHS[m]} ${y}`, time: new Date(y, m, 1).getTime() };
  }

  if (input instanceof Date) {
    const m = isNaN(input.getTime()) ? new Date().getMonth() : input.getMonth();
    const y = isNaN(input.getTime()) ? new Date().getFullYear() : input.getFullYear();
    return { key: `${PT_MONTHS[m]} ${y}`, time: new Date(y, m, 1).getTime() };
  }

  // Clean unicode whitespace, non-breaking spaces and extra spaces
  const clean = String(input)
    .replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
    .trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (ddmmyyyy) {
    const m = parseInt(ddmmyyyy[2], 10) - 1;
    const y = parseInt(ddmmyyyy[3], 10);
    if (m >= 0 && m <= 11) {
      return { key: `${PT_MONTHS[m]} ${y}`, time: new Date(y, m, 1).getTime() };
    }
  }

  // Pattern: YYYY-MM-DD or YYYY-MM
  const yyyymm = clean.match(/^(\d{4})[\/\.-](\d{1,2})(?:[\/\.-](\d{1,2}))?$/);
  if (yyyymm) {
    const y = parseInt(yyyymm[1], 10);
    const m = parseInt(yyyymm[2], 10) - 1;
    if (m >= 0 && m <= 11) {
      return { key: `${PT_MONTHS[m]} ${y}`, time: new Date(y, m, 1).getTime() };
    }
  }

  // Pattern: MM/YYYY or M/YYYY
  const mmyyyy = clean.match(/^(\d{1,2})[\/\.-](\d{4})$/);
  if (mmyyyy) {
    const m = parseInt(mmyyyy[1], 10) - 1;
    const y = parseInt(mmyyyy[2], 10);
    if (m >= 0 && m <= 11) {
      return { key: `${PT_MONTHS[m]} ${y}`, time: new Date(y, m, 1).getTime() };
    }
  }

  // Pattern: Text containing Month Name and 4-digit Year (e.g. 'Ago. de 2026', 'Ago 2026', 'Agosto 2026', 'Ago/2026')
  const yearMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const words = clean.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúç]/gi, ' ').split(/\s+/);
    for (const w of words) {
      if (MONTH_MAP[w] !== undefined) {
        const m = MONTH_MAP[w];
        return { key: `${PT_MONTHS[m]} ${year}`, time: new Date(year, m, 1).getTime() };
      }
    }
  }

  // Fallback: Native Date parsing
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const m = d.getMonth();
    const y = d.getFullYear();
    return { key: `${PT_MONTHS[m]} ${y}`, time: new Date(y, m, 1).getTime() };
  }

  // Default fallback to current month
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  return { key: `${PT_MONTHS[m]} ${y}`, time: new Date(y, m, 1).getTime() };
}

/**
 * Returns a standardized capitalized month-year string, e.g., "Ago 2026"
 */
export function getMonthYearKey(date?: Date | string): string {
  return parseToMonthYear(date).key;
}

/**
 * Consolidates, deduplicates and sorts history entries by month/year.
 * If multiple entries belong to the same month (e.g. multiple "Ago 2026" or "Ago. de 2026"),
 * it sums their `depositAmount` and retains the latest/highest `totalEquity`.
 */
export function consolidateHistory(rawHistory: HistorySnapshot[]): HistorySnapshot[] {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return [];

  const map = new Map<string, { id: string; date: string; depositAmount: number; totalEquity: number; _time: number }>();

  for (const item of rawHistory) {
    if (!item) continue;
    const { key, time } = parseToMonthYear(item.date);
    const dep = Number(item.depositAmount) || 0;
    const eq = Number(item.totalEquity) || 0;

    if (!map.has(key)) {
      map.set(key, {
        id: item.id || Math.random().toString(36).substring(2, 9),
        date: key,
        depositAmount: dep,
        totalEquity: eq,
        _time: time
      });
    } else {
      const existing = map.get(key)!;
      existing.depositAmount = parseFloat((existing.depositAmount + dep).toFixed(2));
      if (eq > 0) {
        existing.totalEquity = eq;
      }
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => a._time - b._time);
  return sorted.map(({ id, date, depositAmount, totalEquity }) => ({
    id,
    date,
    depositAmount: parseFloat(depositAmount.toFixed(2)),
    totalEquity: parseFloat(totalEquity.toFixed(2))
  }));
}

export function getHistory(): HistorySnapshot[] {
  const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (saved) {
    try {
      const parsed: HistorySnapshot[] = JSON.parse(saved);
      const consolidated = consolidateHistory(parsed);

      // If consolidation changed the array length or serialized contents, update localStorage
      if (JSON.stringify(consolidated) !== saved) {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(consolidated));
      }
      return consolidated;
    } catch (e) {
      console.error('Failed to parse history', e);
    }
  }
  return [];
}

export function saveHistory(history: HistorySnapshot[]) {
  const consolidated = consolidateHistory(history);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(consolidated));
  // Dispatch a custom event to notify components that history was updated
  window.dispatchEvent(new Event('pe_history_updated'));
}

/**
 * Logs an automated contribution.
 * It finds or creates the month bar (e.g., "Ago 2026") based on the provided date.
 * It accumulates the `amountBRL` to that month's `depositAmount`.
 * It updates the `totalEquity` to the latest provided value for that month.
 */
export function logAutomatedContribution(amountBRL: number, currentEquityBRL: number, dateStr?: string) {
  if (amountBRL <= 0) return; // Only log positive contributions

  const history = getHistory();
  const { key: monthKey } = parseToMonthYear(dateStr);

  const existingIndex = history.findIndex(h => h.date === monthKey);

  if (existingIndex !== -1) {
    // Accumulate the deposit amount and overwrite totalEquity (to keep it fresh for the month)
    history[existingIndex].depositAmount = parseFloat((history[existingIndex].depositAmount + amountBRL).toFixed(2));
    if (currentEquityBRL > 0) {
      history[existingIndex].totalEquity = parseFloat(currentEquityBRL.toFixed(2));
    }
  } else {
    // Create new entry
    history.push({
      id: Math.random().toString(36).substring(2, 9),
      date: monthKey,
      depositAmount: parseFloat(amountBRL.toFixed(2)),
      totalEquity: currentEquityBRL > 0 ? parseFloat(currentEquityBRL.toFixed(2)) : 0,
    });
  }

  saveHistory(history);
}
