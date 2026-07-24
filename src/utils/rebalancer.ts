/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, CategoryAllocation, RebalanceOutput, CategoryRebalanceResult, Recommendation } from '../types';

export function getDefaultDecimals(categoryName: string): number {
  const name = categoryName.toLowerCase().trim();
  
  // FII, ações Br e ETF Br (inteiros)
  if (name.includes('fii')) {
    return 0;
  }
  if (name.includes('ação') || name.includes('acao') || name === 'ações' || name === 'acoes') {
    return 0;
  }
  // "ETF Br" or any local ETF (not international)
  if (name.includes('etf') && !name.includes('internac') && !name.includes('global') && !name.includes('usd') && !name.includes('estrangeiro')) {
    return 0;
  }
  
  // Tesouro Direto (2 casas decimais)
  if (name.includes('tesouro') || name.includes('renda fixa') || name.includes('td')) {
    return 2;
  }

  // Cripto (6 casas decimais)
  if (name.includes('cripto') || name.includes('crypto') || name.includes('btc') || name.includes('eth') || name.includes('bitcoin')) {
    return 6;
  }

  // REIT, STOCK, ETF Internacional (fracionados, e.g., 4 casas decimais)
  if (name.includes('reit')) {
    return 4;
  }
  if (name.includes('stock') || name.includes('ação internacional') || name.includes('acao internacional')) {
    return 4;
  }
  if (name.includes('etf internac') || name.includes('etf global') || name.includes('etf usd')) {
    return 4;
  }

  // Outros padrão: 2 casas decimais
  return 2;
}

export function roundToDecimals(value: number, decimals: number): number {
  if (decimals === 0) {
    return Math.floor(value); // safer for whole shares
  }
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor; // floor to stay within budget
}

/**
 * Executes the Predictive Allocation Algorithm with Score-Weighted Distance-to-Target Selection
 */
export function calculateRebalance(
  assets: Asset[],
  allocations: CategoryAllocation[],
  depositAmount: number,
  usdToBrlRate: number = 5.50
): RebalanceOutput {
  // Helper to safely get the current BRL value of an asset
  const getBrlValue = (asset: Asset): number => {
    if (asset.currentValue !== undefined && asset.currentValue !== null) {
      return asset.currentValue;
    }
    // Fallback if client hasn't computed it yet
    const nativeVal = asset.invested_amount || 0;
    return asset.currency === 'USD' ? nativeVal * usdToBrlRate : nativeVal;
  };

  // Step 0 & 1: Calculate Current Total Equity & Future Total Equity
  const currentTotalEquity = assets.reduce((sum, asset) => sum + getBrlValue(asset), 0);
  const futureTotalEquity = currentTotalEquity + depositAmount;

  // List all unique categories across assets and target configurations
  const uniqueCategories = Array.from(
    new Set([
      ...allocations.map(a => a.category),
      ...assets.map(a => a.category),
    ])
  ).filter(cat => cat !== '');

  // Map of category name to target percentage
  const allocationMap = new Map<string, number>();
  allocations.forEach(a => {
    allocationMap.set(a.category, a.target_percentage);
  });

  // Calculate current value for each category (sum of its assets' BRL values)
  const categoryCurrentValues = new Map<string, number>();
  uniqueCategories.forEach(cat => {
    const value = assets
      .filter(asset => asset.category === cat)
      .reduce((sum, asset) => sum + getBrlValue(asset), 0);
    categoryCurrentValues.set(cat, value);
  });

  // Distribute the deposit proportionally among deficient categories.
  let remainingDeposit = depositAmount;
  const categoryAllocations = new Map<string, number>();
  uniqueCategories.forEach(cat => categoryAllocations.set(cat, 0));

  // Determine deficient categories that have eligible assets
  let activeCategories = uniqueCategories.filter(cat => {
    const targetPct = allocationMap.get(cat) || 0;
    const futureTargetVal = futureTotalEquity * (targetPct / 100);
    const currVal = categoryCurrentValues.get(cat) || 0;
    const deficiency = futureTargetVal - currVal;
    
    // An active category must have positive deficiency and at least one non-quarantined asset
    const hasEligibleAssets = assets.some(a => a.category === cat && !a.is_quarantined);
    return deficiency > 0 && hasEligibleAssets;
  });

  // Distribute deposit proportionally to category deficiencies in an iterative loop (max 5 iterations)
  let iterations = 0;
  while (remainingDeposit > 0.01 && activeCategories.length > 0 && iterations < 5) {
    iterations++;

    // Calculate deficiencies based on current allocated amounts in this loop
    const deficiencies = activeCategories.map(cat => {
      const targetPct = allocationMap.get(cat) || 0;
      const futureTargetVal = futureTotalEquity * (targetPct / 100);
      const currVal = (categoryCurrentValues.get(cat) || 0) + (categoryAllocations.get(cat) || 0);
      return {
        category: cat,
        deficiency: Math.max(0, futureTargetVal - currVal),
      };
    });

    const totalDeficiency = deficiencies.reduce((sum, d) => sum + d.deficiency, 0);

    if (totalDeficiency <= 0) {
      // If there's no more deficiency, split remaining cash evenly among all active categories
      const share = remainingDeposit / activeCategories.length;
      activeCategories.forEach(cat => {
        categoryAllocations.set(cat, (categoryAllocations.get(cat) || 0) + share);
      });
      remainingDeposit = 0;
      break;
    }

    const depositToAllocate = remainingDeposit;
    let allocatedInThisPass = 0;

    deficiencies.forEach(d => {
      const proportion = d.deficiency / totalDeficiency;
      let amount = depositToAllocate * proportion;

      // Limit allocation to the deficiency unless this is the only active category left
      if (amount > d.deficiency && activeCategories.length > 1) {
        amount = d.deficiency;
      }

      categoryAllocations.set(d.category, (categoryAllocations.get(d.category) || 0) + amount);
      allocatedInThisPass += amount;
    });

    remainingDeposit -= allocatedInThisPass;

    // Filter active categories for the next pass
    activeCategories = activeCategories.filter(cat => {
      const targetPct = allocationMap.get(cat) || 0;
      const futureTargetVal = futureTotalEquity * (targetPct / 100);
      const currVal = (categoryCurrentValues.get(cat) || 0) + (categoryAllocations.get(cat) || 0);
      const deficiency = futureTargetVal - currVal;
      return deficiency > 0.01;
    });
  }

  // Structures to hold recommended buy amounts (in BRL) and quantities for each ticker
  const tickerToAllocatedAmount = new Map<string, number>();
  const tickerToAllocatedQty = new Map<string, number>();

  // A global list to collect all selected/eligible assets across all categories
  interface EligibleAssetInfo {
    asset: Asset;
    category: string;
    decimals: number;
    unitPriceBrl: number;
    originalDistanceToTarget: number;
  }
  const allEligibleAssets: EligibleAssetInfo[] = [];

  // A map to remember the selected assets for each category (so we always report them, even if quantity is 0)
  const categorySelectedAssets = new Map<string, Asset[]>();

  // Identify eligible assets for each category, and do Pass 1
  let spareChangePool = Math.max(0, remainingDeposit);

  uniqueCategories.forEach(cat => {
    const targetPct = allocationMap.get(cat) || 0;
    const futureTargetVal = futureTotalEquity * (targetPct / 100);
    const currVal = categoryCurrentValues.get(cat) || 0;
    const allocated = categoryAllocations.get(cat) || 0;

    const validAssets = assets.filter(a => a.category === cat && !a.is_quarantined);
    if (validAssets.length === 0) {
      categorySelectedAssets.set(cat, []);
      return;
    }

    // Step 5 (Asset Level Selection):
    // 1. Sum the `score` of all valid assets in this category.
    const totalScore = validAssets.reduce((sum, a) => sum + (a.score !== undefined ? a.score : 10), 0);

    // 2. Calculate Distance to Target for each asset
    const assetsWithDistances = validAssets.map(asset => {
      const score = asset.score !== undefined ? asset.score : 10;
      const targetPercentWithinCategory = totalScore > 0 ? score / totalScore : 0;
      const targetValueBRL = futureTargetVal * targetPercentWithinCategory;
      const currentValueBRL = getBrlValue(asset);
      const distanceToTarget = targetValueBRL - currentValueBRL;

      let unitPriceBrl = 1;
      if (asset.livePrice && asset.livePrice > 0) {
        unitPriceBrl = asset.currency === 'USD' ? asset.livePrice * usdToBrlRate : asset.livePrice;
      } else if (asset.quantity > 0) {
        unitPriceBrl = getBrlValue(asset) / asset.quantity;
      }

      return {
        asset,
        distanceToTarget,
        unitPriceBrl,
      };
    });

    // Step 6: Sort valid assets by highest Distance to Target (most deficient)
    assetsWithDistances.sort((a, b) => b.distanceToTarget - a.distanceToTarget);

    // Select STRICT MAXIMUM OF 2 ASSETS per category
    const selectedWithDistances = assetsWithDistances.slice(0, 2);
    categorySelectedAssets.set(cat, selectedWithDistances.map(item => item.asset));

    const targetAlloc = allocations.find(al => al.category === cat);
    const decimals = targetAlloc && targetAlloc.decimal_places !== undefined 
      ? targetAlloc.decimal_places 
      : getDefaultDecimals(cat);

    // Add selected assets to the global eligible assets array
    selectedWithDistances.forEach(item => {
      allEligibleAssets.push({
        asset: item.asset,
        category: cat,
        decimals,
        unitPriceBrl: item.unitPriceBrl,
        originalDistanceToTarget: item.distanceToTarget,
      });
    });

    // PASS 1: Sequential Allocation within Category's Allocated Budget
    let remainingCategoryFunds = allocated;

    if (remainingCategoryFunds > 0 && selectedWithDistances.length > 0) {
      // 1. First sequential pass to meet deficiency (most deficient first)
      selectedWithDistances.forEach(item => {
        if (remainingCategoryFunds <= 0.01) return;
        
        const originalDistance = item.distanceToTarget;
        if (originalDistance <= 0) return;

        // Determine target budget for this pass
        let targetBudget = originalDistance;
        if (decimals === 0) {
          // If integer asset, make sure we allocate at least the unit price so we can buy 1 share if possible
          targetBudget = Math.max(originalDistance, item.unitPriceBrl);
        }

        const budgetToSpend = Math.min(targetBudget, remainingCategoryFunds);
        if (budgetToSpend > 0) {
          let qty = roundToDecimals(budgetToSpend / item.unitPriceBrl, decimals);
          
          // Double check cost constraints
          let cost = qty * item.unitPriceBrl;
          if (cost > remainingCategoryFunds) {
            qty = Math.floor(remainingCategoryFunds / item.unitPriceBrl);
            cost = qty * item.unitPriceBrl;
          }

          if (qty > 0) {
            tickerToAllocatedAmount.set(item.asset.ticker, cost);
            tickerToAllocatedQty.set(item.asset.ticker, qty);
            remainingCategoryFunds -= cost;
          }
        }
      });

      // 2. Second mini-pass to maximize usage of leftover category funds (buy extra fractions or integer shares)
      if (remainingCategoryFunds > 0.01) {
        const totalSelectedScore = selectedWithDistances.reduce((sum, item) => sum + (item.asset.score !== undefined ? item.asset.score : 10), 0);
        if (totalSelectedScore > 0) {
          const originalRemaining = remainingCategoryFunds;
          selectedWithDistances.forEach(item => {
            if (remainingCategoryFunds <= 0.01) return;
            const score = item.asset.score !== undefined ? item.asset.score : 10;
            const shareAmount = originalRemaining * (score / totalSelectedScore);
            const budgetToSpend = Math.min(shareAmount, remainingCategoryFunds);

            if (budgetToSpend > 0) {
              if (decimals === 0) {
                const extraQty = Math.floor(budgetToSpend / item.unitPriceBrl);
                if (extraQty > 0) {
                  const cost = extraQty * item.unitPriceBrl;
                  tickerToAllocatedAmount.set(item.asset.ticker, (tickerToAllocatedAmount.get(item.asset.ticker) || 0) + cost);
                  tickerToAllocatedQty.set(item.asset.ticker, (tickerToAllocatedQty.get(item.asset.ticker) || 0) + extraQty);
                  remainingCategoryFunds -= cost;
                }
              } else {
                const extraQty = roundToDecimals(budgetToSpend / item.unitPriceBrl, decimals);
                if (extraQty > 0) {
                  const cost = extraQty * item.unitPriceBrl;
                  tickerToAllocatedAmount.set(item.asset.ticker, (tickerToAllocatedAmount.get(item.asset.ticker) || 0) + cost);
                  tickerToAllocatedQty.set(item.asset.ticker, (tickerToAllocatedQty.get(item.asset.ticker) || 0) + extraQty);
                  remainingCategoryFunds -= cost;
                }
              }
            }
          });
        }
      }
    }

    // Any leftover category funds are returned to the global spare change pool
    spareChangePool += remainingCategoryFunds;
  });

  // PASS 2: Global Spare Change Reallocation (Iterative optimization loop)
  // We do up to 3 passes to optimize, ensuring any leftover cash buys more assets
  let pass2Iterations = 0;
  while (spareChangePool > 0.01 && allEligibleAssets.length > 0 && pass2Iterations < 3) {
    pass2Iterations++;

    // Re-evaluate remaining distance to target for each asset
    const assetsWithRemainingDistances = allEligibleAssets.map(item => {
      const spent = tickerToAllocatedAmount.get(item.asset.ticker) || 0;
      const remainingDistance = item.originalDistanceToTarget - spent;
      return {
        ...item,
        remainingDistance,
      };
    });

    // Sort globally by remaining distance to target (highest first)
    assetsWithRemainingDistances.sort((a, b) => b.remainingDistance - a.remainingDistance);

    let spentInPass = 0;
    assetsWithRemainingDistances.forEach(item => {
      if (spareChangePool <= 0.01) return;
      if (item.originalDistanceToTarget <= 0) return; // ignore non-deficient assets if possible

      // If we are below the target weight, prioritize satisfying the deficiency
      let targetBudget = item.remainingDistance;
      if (item.decimals === 0) {
        // For integer assets, we must allocate at least the unit price to buy 1 unit
        targetBudget = Math.max(item.remainingDistance, item.unitPriceBrl);
      }

      const budgetToSpend = Math.min(targetBudget, spareChangePool);
      if (budgetToSpend > 0) {
        let qty = roundToDecimals(budgetToSpend / item.unitPriceBrl, item.decimals);
        let cost = qty * item.unitPriceBrl;

        if (cost > spareChangePool) {
          qty = Math.floor(spareChangePool / item.unitPriceBrl);
          cost = qty * item.unitPriceBrl;
        }

        if (qty > 0) {
          tickerToAllocatedAmount.set(item.asset.ticker, (tickerToAllocatedAmount.get(item.asset.ticker) || 0) + cost);
          tickerToAllocatedQty.set(item.asset.ticker, (tickerToAllocatedQty.get(item.asset.ticker) || 0) + qty);
          spareChangePool -= cost;
          spentInPass += cost;
        }
      }
    });

    // If we couldn't spend anything in this pass, break to avoid an infinite loop
    if (spentInPass <= 0.01) {
      break;
    }
  }

  // PASS 2b: Last-Resort Round-Robin for Remaining Integer Units
  if (spareChangePool > 0.01) {
    const integerAssets = allEligibleAssets.filter(item => item.decimals === 0);
    if (integerAssets.length > 0) {
      // Sort them by remaining distance descending
      integerAssets.forEach(item => {
        const spent = tickerToAllocatedAmount.get(item.asset.ticker) || 0;
        (item as any).remainingDistance = item.originalDistanceToTarget - spent;
      });
      integerAssets.sort((a, b) => (b as any).remainingDistance - (a as any).remainingDistance);

      let boughtAny = true;
      while (spareChangePool > 0.01 && boughtAny) {
        boughtAny = false;
        for (const item of integerAssets) {
          if (spareChangePool >= item.unitPriceBrl) {
            tickerToAllocatedAmount.set(item.asset.ticker, (tickerToAllocatedAmount.get(item.asset.ticker) || 0) + item.unitPriceBrl);
            tickerToAllocatedQty.set(item.asset.ticker, (tickerToAllocatedQty.get(item.asset.ticker) || 0) + 1);
            spareChangePool -= item.unitPriceBrl;
            boughtAny = true;
            if (spareChangePool <= 0.01) break;
          }
        }
      }
    }
  }

  // Construct final CategoryRebalanceResults
  const results: CategoryRebalanceResult[] = [];

  uniqueCategories.forEach(cat => {
    const targetPct = allocationMap.get(cat) || 0;
    const futureTargetVal = futureTotalEquity * (targetPct / 100);
    const currVal = categoryCurrentValues.get(cat) || 0;

    const currentWeight = currentTotalEquity > 0 ? (currVal / currentTotalEquity) * 100 : 0;

    const recommendations: Recommendation[] = [];
    let actualAllocatedForCategory = 0;

    const selectedAssets = categorySelectedAssets.get(cat) || [];
    selectedAssets.forEach(asset => {
      const amount = tickerToAllocatedAmount.get(asset.ticker) || 0;
      const qty = tickerToAllocatedQty.get(asset.ticker) || 0;

      if (amount > 0 && qty > 0) {
        actualAllocatedForCategory += amount;

        recommendations.push({
          ticker: asset.ticker,
          category: asset.category,
          amount,
          currency: asset.currency,
          estimatedQuantityIncrease: qty,
        });
      }
    });

    const futureValue = currVal + actualAllocatedForCategory;
    const futureWeight = futureTotalEquity > 0 ? (futureValue / futureTotalEquity) * 100 : 0;

    results.push({
      category: cat,
      allocatedAmount: actualAllocatedForCategory,
      currentValue: currVal,
      currentWeight,
      targetWeight: targetPct,
      futureValue,
      futureWeight,
      recommendations,
    });
  });

  // Sort categories by target weight descending
  results.sort((a, b) => b.targetWeight - a.targetWeight);

  return {
    depositAmount,
    futureTotalEquity,
    results,
  };
}
