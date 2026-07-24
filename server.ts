/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import YahooFinanceRaw from 'yahoo-finance2';

// Handle esbuild default import interop in CommonJS compilation
const YahooFinance = (YahooFinanceRaw as any).default || YahooFinanceRaw;

const yahooFinance = new YahooFinance({
  validation: {
    logErrors: false,
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Live Quotes Fetcher
  app.post('/api/quotes', async (req, res) => {
    try {
      const { assets } = req.body as { assets: { ticker: string; currency: string; category?: string }[] };
      
      if (!assets || !Array.isArray(assets)) {
        res.status(400).json({ error: 'Missing or invalid assets array' });
        return;
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

      const quotesList = await Promise.all(quotePromises);
      
      // Convert to map for client ease
      const quotesMap: Record<string, number | null> = {};
      quotesList.forEach((q) => {
        quotesMap[q.ticker] = q.price;
      });

      res.json({
        quotes: quotesMap,
        usdBrlRate,
      });
    } catch (err) {
      console.error('Server error handling quotes API:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite development integration or static files hosting
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
});
