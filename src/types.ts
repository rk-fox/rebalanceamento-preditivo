/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Currency = 'BRL' | 'USD';

export interface Asset {
  id: string; // UUID or string
  ticker: string;
  category: string;
  quantity: number;
  currency: Currency;
  invested_amount: number; // Native currency total cost basis
  score: number; // 1-10 risk/rebalance score, default 10
  is_quarantined: boolean;
  
  // Client-side computed live price fields
  livePrice?: number; // In native currency (BRL or USD)
  currentValue?: number; // In BRL (converted if USD)
  variationPercent?: number; // ((currentValue / invested_amount_in_brl) - 1) * 100
  quoteFailed?: boolean; // True if the live quote could not be fetched from the API
}

export interface CategoryAllocation {
  category: string;
  target_percentage: number; // target percentage, e.g., 25
  decimal_places?: number; // custom decimal places, e.g., 0, 2, 4, 6
}

export interface Recommendation {
  ticker: string;
  category: string;
  amount: number; // in BRL
  currency: Currency;
  estimatedQuantityIncrease?: number;
}

export interface CategoryRebalanceResult {
  category: string;
  allocatedAmount: number; // BRL
  currentValue: number; // BRL
  currentWeight: number; // %
  targetWeight: number; // %
  futureValue: number; // BRL
  futureWeight: number; // %
  recommendations: Recommendation[];
}

export interface RebalanceOutput {
  depositAmount: number;
  futureTotalEquity: number;
  results: CategoryRebalanceResult[];
}

