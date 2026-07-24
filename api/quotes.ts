import YahooFinanceRaw from 'yahoo-finance2';

const YahooFinance = (YahooFinanceRaw as any).default || YahooFinanceRaw;

const yahooFinance = new YahooFinance({
  validation: {
    logErrors: false,
  },
});

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { assets } = req.body as { assets: { ticker: string; currency: string; category?: string }[] };
    
    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'Missing or invalid assets array' });
    }

    // Fetch exchange rate
    let usdBrlRate = 5.50;
    try {
      const rateResult = await yahooFinance.quote('USDBRL=X') as any;
      usdBrlRate = (rateResult && (rateResult.regularMarketPrice || rateResult.previousClose)) || 5.50;
    } catch (rateErr) {
      try {
        const altRateResult = await yahooFinance.quote('BRL=X') as any;
        usdBrlRate = (altRateResult && (altRateResult.regularMarketPrice || altRateResult.previousClose)) || 5.50;
      } catch (altRateErr) {
        console.error('Could not fetch BRL=X or USDBRL=X, using 5.50:', altRateErr);
      }
    }

    // Fetch quotes in parallel safely (catch individual errors)
    const quotePromises = assets.map(async (asset) => {
      const ticker = asset.ticker.toUpperCase();
      const currency = asset.currency;
      const category = asset.category || '';
      
      const isCrypto = category.toLowerCase().includes('cripto') ||
                       category.toLowerCase().includes('crypto') ||
                       ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'DOGE', 'XRP', 'LINK', 'LTC', 'BCH'].includes(ticker);

      let queryTicker = ticker;
      if (isCrypto) {
        queryTicker = `${ticker}-USD`;
      } else if (currency === 'BRL' && !ticker.includes('.')) {
        queryTicker = `${ticker}.SA`;
      }

      try {
        const quoteResult = await yahooFinance.quote(queryTicker) as any;
        let price = (quoteResult && (quoteResult.regularMarketPrice || quoteResult.previousClose)) || null;
        
        if (price !== null && isCrypto) {
          // Convert to BRL if asset's currency is BRL
          if (currency === 'BRL') {
            price = price * usdBrlRate;
          }
        }

        return {
          ticker,
          price,
          success: price !== null,
        };
      } catch (quoteErr) {
        // If query with .SA failed, try without suffix
        if (queryTicker.endsWith('.SA')) {
          try {
            const simpleResult = await yahooFinance.quote(ticker) as any;
            const price = (simpleResult && (simpleResult.regularMarketPrice || simpleResult.previousClose)) || null;
            return {
              ticker,
              price,
              success: price !== null,
            };
          } catch (simpleErr) {
            // Ignore and fall back
          }
        }
        console.error(`Failed to fetch quote for ${ticker} (queried as ${queryTicker}):`, quoteErr);
        return {
          ticker,
          price: null,
          success: false,
        };
      }
    });

    const results = await Promise.all(quotePromises);

    // Convert to map for client ease
    const quotesMap: Record<string, number | null> = {};
    results.forEach((q) => {
      quotesMap[q.ticker] = q.price;
    });

    return res.status(200).json({
      quotes: quotesMap,
      usdBrlRate,
    });
  } catch (error: any) {
    console.error('Error fetching live quotes:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
