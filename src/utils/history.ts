export interface HistorySnapshot {
  id: string;
  date: string;
  depositAmount: number;
  totalEquity: number;
}

export const HISTORY_STORAGE_KEY = 'pe_portfolio_history';

export function getHistory(): HistorySnapshot[] {
  const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse history', e);
    }
  }
  return [];
}

export function saveHistory(history: HistorySnapshot[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  // Dispatch a custom event to notify components that history was updated
  window.dispatchEvent(new Event('pe_history_updated'));
}

/**
 * Parses a DD/MM/YYYY string or an ISO date into a Date object.
 * If dateStr is empty/invalid, returns today.
 */
function parseDateString(dateStr?: string): Date {
  if (!dateStr) return new Date();
  // Check DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  // Try ISO or native parsing
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Returns a capitalized month-year string, e.g., "Ago 2026"
 */
export function getMonthYearKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' });
  const dateStr = formatter.format(date);
  return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
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
  const dateObj = parseDateString(dateStr);
  const monthKey = getMonthYearKey(dateObj);

  const existingIndex = history.findIndex(h => h.date === monthKey);

  if (existingIndex !== -1) {
    // Accumulate the deposit amount and overwrite totalEquity (to keep it fresh for the month)
    history[existingIndex].depositAmount += amountBRL;
    history[existingIndex].totalEquity = currentEquityBRL;
  } else {
    // Create new entry
    history.push({
      id: Math.random().toString(36).substring(2, 9),
      date: monthKey,
      depositAmount: amountBRL,
      totalEquity: currentEquityBRL,
    });
  }

  // Sort history chronologically.
  // Note: 'date' is "Mês YYYY". To sort, we parse it back to a rough date.
  const ptMonths = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  history.sort((a, b) => {
    const parseMonthYear = (str: string) => {
      const parts = str.toLowerCase().replace('.', '').split(' ');
      if (parts.length < 2) return 0;
      const mIdx = ptMonths.indexOf(parts[0]);
      const year = parseInt(parts[parts.length - 1], 10) || 0;
      return new Date(year, Math.max(0, mIdx), 1).getTime();
    };
    return parseMonthYear(a.date) - parseMonthYear(b.date);
  });

  saveHistory(history);
}
