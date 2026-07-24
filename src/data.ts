/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, CategoryAllocation } from './types';

export const INITIAL_CATEGORIES: CategoryAllocation[] = [
  { category: 'Ações', target_percentage: 30 },
  { category: 'FIIs', target_percentage: 25 },
  { category: 'Tesouro Direto', target_percentage: 20 },
  { category: 'Reits', target_percentage: 15 },
  { category: 'ETFs Internacionais', target_percentage: 10 },
];

export const INITIAL_ASSETS: Asset[] = [
  {
    id: '1',
    ticker: 'WEGE3',
    category: 'Ações',
    quantity: 100,
    currency: 'BRL',
    invested_amount: 4000,
    score: 10,
    is_quarantined: false,
  },
  {
    id: '2',
    ticker: 'VALE3',
    category: 'Ações',
    quantity: 50,
    currency: 'BRL',
    invested_amount: 3200,
    score: 8,
    is_quarantined: false,
  },
  {
    id: '3',
    ticker: 'ITSA4',
    category: 'Ações',
    quantity: 200,
    currency: 'BRL',
    invested_amount: 2100,
    score: 9,
    is_quarantined: false,
  },
  {
    id: '4',
    ticker: 'EGIE3',
    category: 'Ações',
    quantity: 50,
    currency: 'BRL',
    invested_amount: 2000,
    score: 5,
    is_quarantined: true, // Let's quarantine EGIE3 as a visual demonstration
  },
  {
    id: '5',
    ticker: 'HGLG11',
    category: 'FIIs',
    quantity: 20,
    currency: 'BRL',
    invested_amount: 3200,
    score: 10,
    is_quarantined: false,
  },
  {
    id: '6',
    ticker: 'XPML11',
    category: 'FIIs',
    quantity: 20,
    currency: 'BRL',
    invested_amount: 2100,
    score: 7,
    is_quarantined: false,
  },
  {
    id: '7',
    ticker: 'KNIP11',
    category: 'FIIs',
    quantity: 20,
    currency: 'BRL',
    invested_amount: 1800,
    score: 8,
    is_quarantined: false,
  },
  {
    id: '8',
    ticker: 'Tesouro IPCA+ 2035',
    category: 'Tesouro Direto',
    quantity: 1,
    currency: 'BRL',
    invested_amount: 5000,
    score: 10,
    is_quarantined: false,
  },
  {
    id: '9',
    ticker: 'O',
    category: 'Reits',
    quantity: 20,
    currency: 'USD',
    invested_amount: 1000, // $1,000 at 5.50 rate
    score: 10,
    is_quarantined: false,
  },
  {
    id: '10',
    ticker: 'AMT',
    category: 'Reits',
    quantity: 5,
    currency: 'USD',
    invested_amount: 500, // $500 at 5.50 rate
    score: 8,
    is_quarantined: false,
  },
  {
    id: '11',
    ticker: 'IVVB11',
    category: 'ETFs Internacionais',
    quantity: 15,
    currency: 'BRL',
    invested_amount: 4000,
    score: 10,
    is_quarantined: false,
  }
];
