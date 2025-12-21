import { Hono } from 'hono';
import { PriceWatcher } from './tracker';
import puppeteer from '@cloudflare/puppeteer';

type Bindings = {
  WATCHER: DurableObjectNamespace;
  AI: any;
  MYBROWSER: any;
};

const app = new Hono<{ Bindings: Bindings }>();

// Export V7 to match your wrangler.toml migration
export { PriceWatcher as WatcherV7 };

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WatchIT v2 | Book Tracker</title>
    </head>
    <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f0f2f5; color:#333;">
      <div style="background:white; padding:40px; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.1); display:inline-block; width:450px; text-align:left;">
        <h1 style="color:#1a73e8; text-align:center; margin-top:0;">📚 WatchIT v2</h1>
        <p style="text-align:center; color:#666; margin-bottom:25px;">Search any book on the sandbox site</p>
        
        <label style="font-weight:bold; font-size:14px;">Book Title</label>
        <input type="text" id="bookSearch" placeholder="e.g. 'A Light in the Attic'" 
               style="width:100%; padding:14px; margin:8px 0 20px 0; border-radius:8px; border:1px solid #ddd; box-sizing:border-box; font-size:16px;">
        
        <button id="btnScrape" onclick="run()" style="width:100%; padding:15px; background:#1a73e8; color:white; border:none; border-radius:12px; cursor:pointer; font-weight:bold; transition: 0.2s;">🔍 Search & Scrape</button>
        <button id="btnAI" onclick="askAI()" style="width:100%; margin-top:12px; padding:15px; background:#34a853; color:white; border:none; border-radius:12px; cursor:pointer; font-weight:bold; transition: 0.2s;">🤖 Analyze with AI</button>
        
        <div id="status" style="margin-top:25px; padding:20px; background:#f8f9fa; border-radius:12px; font-family:monospace; font-size:13px; border:1px solid #ddd; min-height:60px; line-height:1.5;">
            Ready to search...
        </div>
      </div>

      <script>
        function toggleUI(loading, btnId, loadingText, originalText) {
            const btn = document.getElementById(btnId);
            const status = document.getElementById('status');
            const otherBtn = btnId === 'btnScrape' ? document.getElementById('btnAI') : document.getElementById('btnScrape');
            
            if (loading) {
                btn.disabled = true;
                otherBtn.disabled = true;
                btn.innerText = loadingText;
                btn.style.opacity = "0.6";
                status.innerHTML = '<span style="color:#1a73e8">⌛ Working... please wait.</span>';
            } else {
                btn.disabled = false;
                otherBtn.disabled = false;
                btn.innerText = originalText;
                btn.style.opacity = "1";
            }
        }

        async function run() {
            const query = document.getElementById('bookSearch').value;
            if(!query) return alert("Enter a book title first!");
            
            toggleUI(true, 'btnScrape', '⏳ Scraping...', '🔍 Search & Scrape');

            try {
                const res = await fetch('/scrape?q=' + encodeURIComponent(query));
                const data = await res.json();
                const s = document.getElementById('status');
                
                if (data.success) {
                    s.innerHTML = "✅ <strong>" + data.foundTitle + "</strong><br>" +
                                 "Price: <span style='color:#2e7d32; font-weight:bold;'>" + data.price + "</span><br>" +
                                 "<small style='color:#666;'>Saved to SQLite memory for '" + query.toLowerCase() + "'.</small>";
                } else {
                    s.innerHTML = "❌ <strong>Error:</strong> " + data.error;
                }
            } catch (e) {
                document.getElementById('status').innerText = "❌ Connection Failed. Make sure wrangler is running.";
            } finally {
                toggleUI(false, 'btnScrape', '', '🔍 Search & Scrape');
            }
        }

        async function askAI() {
            const query = document.getElementById('bookSearch').value;
            if(!query) return alert("Enter a book title first!");
            
            toggleUI(true, 'btnAI', '🧠 Thinking...', '🤖 Analyze with AI');

            try {
                const res = await fetch('/chat?q=' + encodeURIComponent(query));
                const data = await res.json();
                const s = document.getElementById('status');
                
                // ai_analysis.response is the standard output for Workers AI
                const response = data.ai_analysis?.response || "I couldn't generate a response.";
                s.innerHTML = "<strong>AI Analysis (" + query + "):</strong><br><br>" + response;
            } catch (e) {
                document.getElementById('status').innerText = "❌ AI Connection Error.";
            } finally {
                toggleUI(false, 'btnAI', '', '🤖 Analyze with AI');
            }
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/scrape', async (c) => {
  const query = c.req.query('q') || "Dracula";
  const searchUrl = "https://books.toscrape.com/catalogue/category/books_1/index.html";
  let browser;

  try {
    browser = await puppeteer.launch(c.env.MYBROWSER);
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Step 1: Find a book matching the user input
    const bookData = await page.evaluate((searchTerm) => {
      const links = Array.from(document.querySelectorAll('h3 a'));
      const match = links.find(a => a.textContent?.toLowerCase().includes(searchTerm.toLowerCase()));
      if (match) {
        return { 
          title: match.getAttribute('title'), 
          url: (match as HTMLAnchorElement).href 
        };
      }
      return null;
    }, query);

    if (!bookData) throw new Error(`No book found matching "${query}"`);

    // Step 2: Go to book page and grab the price
    await page.goto(bookData.url, { waitUntil: 'domcontentloaded' });
    const price = await page.evaluate(() => document.querySelector('.price_color')?.textContent);
    
    if (!price) throw new Error("Price selector failed on book page.");

    // Step 3: Persistent Storage in Unique Durable Object
    const numericPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
    const id = c.env.WATCHER.idFromName(query.toLowerCase());
    const stub = c.env.WATCHER.get(id);
    await stub.recordPrice(numericPrice);

    return c.json({ success: true, foundTitle: bookData.title, price });

  } catch (err: any) {
    return c.json({ success: false, error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get('/chat', async (c) => {
  const query = c.req.query('q') || "Dracula";
  const id = c.env.WATCHER.idFromName(query.toLowerCase());
  const stub = c.env.WATCHER.get(id);
  const history = await stub.getHistory();

  if (!history || history.length === 0) {
    return c.json({ ai_analysis: { response: "I have no price history for this book yet. Please run a scrape first!" } });
  }

  // Model selection: llama-3-8b-instruct is fast and reliable
  const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: 'You are a retail price analyst. The user is tracking: ' + query },
      { role: 'user', content: `Analyze this SQLite history: ${JSON.stringify(history)}. Give a 2-sentence summary.` }
    ]
  });

  return c.json({ ai_analysis: aiResponse });
});

export default app;
