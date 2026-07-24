/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Currency } from '../types';

export interface ParsedAssetResult {
  ticker: string;
  category: string;
  quantity: number;
  currency: Currency;
  originalValue: number;
  totalValueBRL: number;
  action?: 'compra' | 'venda';
  date?: string;
  accumulatedQuantity?: number;
  unitPrice?: number;
  orderQuantity?: number;
}

/**
 * Helper to compute the actual quantity and invested amount (original value)
 * for a parsed asset based on the import mode ('replace' or 'accumulate')
 * and whether it is a crypto/treasury asset or not.
 */
export function getImportValues(item: ParsedAssetResult, importMode: 'replace' | 'accumulate'): { quantity: number; value: number } {
  // Use parsed order quantity and order value for both modes and all categories.
  // The database merge logic (sum vs overwrite) is handled in App.tsx.
  return {
    quantity: item.quantity,
    value: item.originalValue
  };
}

/**
 * Clean and parse numbers based on Brazilian (1.200,50) or US (1,200.50) formats
 */
export function parseNumberString(valStr: string, isUSD: boolean): number {
  let cleaned = valStr.trim();
  
  // Remove currency symbols, percentage signs, comparative signs and spaces
  cleaned = cleaned.replace(/R\$/g, '')
                   .replace(/US\$/g, '')
                   .replace(/\$/g, '')
                   .replace(/%/g, '')
                   .replace(/[<>\s]/g, '');

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    const commaIndex = cleaned.indexOf(',');
    const dotIndex = cleaned.indexOf('.');
    if (commaIndex > dotIndex) {
      // Comma is after dot (e.g., 1.500,50) -> dot is thousands, comma is decimal
      cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Dot is after comma (e.g., 1,500.50) -> comma is thousands, dot is decimal
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only comma exists (e.g., 0,11 or 1,5 or 1500,5)
    // In any copy-paste from a Brazilian context/browser, a lone comma is ALWAYS a decimal separator.
    cleaned = cleaned.replace(/,/g, '.');
  } else if (hasDot) {
    // Only dot exists (e.g., 155.20 or 17.28334 or 1.500)
    // If isUSD is true, a lone dot is ALWAYS a decimal separator.
    // If isUSD is false, a lone dot could be thousands (e.g. 1.500) or decimal (e.g. 1.50).
    // Let's check: if there are exactly 3 digits after the dot and it's BRL, it's likely a thousands separator.
    if (!isUSD) {
      const parts = cleaned.split('.');
      if (parts.length === 2 && parts[1].length === 3) {
        // e.g. "1.500" -> 1500
        cleaned = cleaned.replace(/\./g, '');
      }
    }
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Robust parsing function for the 9-line broker copy-paste format:
 * [Ticker]
 * [Category]
 * Compra
 * [Quantity]
 * [Unit Price]
 * [Total Value]
 * [Percentage]
 * [Date]
 * manual
 */
export function parseBrokerText(rawText: string, usdToBrlRate: number): ParsedAssetResult[] {
  if (!rawText || !rawText.trim()) return [];

  // Split by line breaks and trim each line
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '');

  const results: ParsedAssetResult[] = [];

  // Helper to check if a string matches the format of a date (DD/MM/YYYY)
  const isDateString = (str: string): boolean => {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(str.trim());
  };

  // Look for the "Compra" or "Venda" action (case-insensitive)
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i].toLowerCase();
    
    // We match "compra" or "venda"
    if (currentLine === 'compra' || currentLine === 'venda') {
      const action: 'compra' | 'venda' = currentLine === 'venda' ? 'venda' : 'compra';
      
      // Ensure we have at least 2 lines before (Ticker and Category)
      if (i >= 2) {
        const category = lines[i - 1];
        const ticker = lines[i - 2].toUpperCase();

        // Collect all lines after "Compra"/"Venda" up to the next logical boundary
        const payloadLines: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          const lineLower = lines[j].toLowerCase();
          if (lineLower === 'manual') {
            break;
          }
          if (lineLower === 'compra' || lineLower === 'venda') {
            // Next block starts. Backtrack the category and ticker of that block.
            if (payloadLines.length >= 2) {
              payloadLines.pop(); // remove category of next block
              payloadLines.pop(); // remove ticker of next block
            } else if (payloadLines.length >= 1) {
              payloadLines.pop();
            }
            break;
          }
          payloadLines.push(lines[j]);
          j++;
        }

        // Determine if it is USD or BRL
        const isUSD = payloadLines.some(line => line.toUpperCase().includes('US$')) ||
                      category.toLowerCase().includes('reit') ||
                      category.toLowerCase().includes('internac');
        const currency: Currency = isUSD ? 'USD' : 'BRL';

        // Check if the first payload line is a Maturity Date (e.g. Tesouro Direto)
        let startIndex = 0;
        if (payloadLines.length > 0 && isDateString(payloadLines[0])) {
          startIndex = 1;
        }

        const remaining = payloadLines.slice(startIndex);

        if (remaining.length >= 3) {
          const quantityRaw = remaining[0];
          const unitPriceRaw = remaining[1];
          const totalValueRaw = remaining[2];

          // Parse numbers
          const quantity = parseNumberString(quantityRaw, isUSD);
          const unitPrice = parseNumberString(unitPriceRaw, isUSD);
          const originalValue = parseNumberString(totalValueRaw, isUSD);
          
          // Convert to BRL if needed
          const totalValueBRL = isUSD ? originalValue * usdToBrlRate : originalValue;

          let accumulatedQuantity: number | undefined = undefined;
          let date: string | undefined = undefined;

          // Parse accumulatedQuantity and date
          if (remaining.length >= 5) {
            const possibleAccum = remaining[3];
            const possibleDate = remaining[4];
            if (isDateString(possibleDate)) {
              accumulatedQuantity = parseNumberString(possibleAccum, isUSD);
              date = possibleDate.trim();
            } else if (isDateString(possibleAccum)) {
              date = possibleAccum.trim();
            }
          } else if (remaining.length >= 4) {
            const possibleDateOrAccum = remaining[3];
            if (isDateString(possibleDateOrAccum)) {
              date = possibleDateOrAccum.trim();
            } else {
              accumulatedQuantity = parseNumberString(possibleDateOrAccum, isUSD);
            }
          }

          // Double check that we got a valid ticker and non-zero value
          if (ticker && ticker.length >= 1 && originalValue > 0) {
            results.push({
              ticker,
              category,
              quantity,
              currency,
              originalValue,
              totalValueBRL,
              action,
              date,
              accumulatedQuantity,
              unitPrice,
              orderQuantity: quantity,
            });
          }
        }
      }
    }
  }

  // Fallback: If no structured "Compra" blocks were parsed, let's try a line-by-line CSV/TSV format parser
  if (results.length === 0) {
    for (const line of lines) {
      const parts = line.split(/[\t,;]/).map(p => p.trim());
      if (parts.length >= 4) {
        // Look for [Ticker, Category, Quantity, TotalValue]
        const ticker = parts[0].toUpperCase();
        const category = parts[1];
        const qtyRaw = parts[2];
        const valRaw = parts[3];

        if (ticker.length >= 1 && isNaN(Number(ticker)) && category) {
          const isUSD = valRaw.toUpperCase().includes('US$') || category.toLowerCase().includes('reit') || category.toLowerCase().includes('internac');
          const currency: Currency = isUSD ? 'USD' : 'BRL';
          const qty = parseNumberString(qtyRaw, isUSD);
          const originalValue = parseNumberString(valRaw, isUSD);
          const totalValueBRL = isUSD ? originalValue * usdToBrlRate : originalValue;

          if (qty > 0 && originalValue > 0) {
            results.push({
              ticker,
              category,
              quantity: qty,
              currency,
              originalValue,
              totalValueBRL,
              action: 'compra',
              unitPrice: qty > 0 ? originalValue / qty : 0,
              orderQuantity: qty,
            });
          }
        }
      }
    }
  }

  // CONSOLIDATE and merge duplicate tickers before returning
  const consolidatedMap = new Map<string, ParsedAssetResult[]>();
  for (const item of results) {
    const key = item.ticker.toUpperCase();
    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, []);
    }
    consolidatedMap.get(key)!.push(item);
  }

  const consolidatedResults: ParsedAssetResult[] = [];

  // Helper to parse dates for chronological sorting (DD/MM/YYYY)
  const parseDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(0);
  };

  for (const [ticker, txs] of consolidatedMap.entries()) {
    // Sort transactions chronologically (oldest first, newest last)
    const sortedTxs = [...txs].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
    const newestTx = sortedTxs[sortedTxs.length - 1];

    const category = newestTx.category;
    const currency = newestTx.currency;

    // Sum order quantities and values sequentially
    let totalOrderQuantity = 0;
    let totalOriginalValue = 0;

    for (const tx of sortedTxs) {
      if (tx.action === 'venda') {
        totalOrderQuantity -= tx.quantity;
        totalOriginalValue -= tx.originalValue;
      } else {
        totalOrderQuantity += tx.quantity;
        totalOriginalValue += tx.originalValue;
      }
    }
    if (totalOrderQuantity < 0) totalOrderQuantity = 0;
    if (totalOriginalValue < 0) totalOriginalValue = 0;

    // Get the most recent accumulated quantity
    let newestAccumQuantity = newestTx.accumulatedQuantity;
    if (newestAccumQuantity === undefined) {
      for (let idx = sortedTxs.length - 1; idx >= 0; idx--) {
        if (sortedTxs[idx].accumulatedQuantity !== undefined) {
          newestAccumQuantity = sortedTxs[idx].accumulatedQuantity;
          break;
        }
      }
    }

    const totalValueBRL = currency === 'USD' ? totalOriginalValue * usdToBrlRate : totalOriginalValue;

    consolidatedResults.push({
      ticker,
      category,
      quantity: totalOrderQuantity,
      currency,
      originalValue: totalOriginalValue,
      totalValueBRL,
      action: newestTx.action,
      date: newestTx.date,
      accumulatedQuantity: newestAccumQuantity,
      unitPrice: newestTx.unitPrice,
      orderQuantity: totalOrderQuantity,
    });
  }

  return consolidatedResults;
}
