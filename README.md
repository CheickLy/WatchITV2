# 📚 WatchIT v2: AI-Powered Price Intelligence

WatchIT v2 is a serverless web scraping and price analysis engine built on the **Cloudflare Edge**. It leverages headless browser automation to track product pricing, stores data in an isolated **SQLite-backed Durable Object** per product, and uses **Llama-3 LLMs** to provide instant market insights.



## 🚀 Key Features

- **Edge Scraping**: Powered by `@cloudflare/puppeteer` for low-latency browser automation.
- **Stateful Memory**: Utilizes **Durable Objects with SQLite** to provide each search query with its own isolated historical database.
- **AI Analytics**: Integration with **Cloudflare Workers AI (Llama-3)** for trend analysis and buy/sell recommendations.
- **Anti-Reset Logic**: Built-in V7 migration system to ensure SQLite compatibility across deployments.

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Runtime** | Cloudflare Workers |
| **Framework** | Hono.js (TypeScript) |
| **Browser** | Cloudflare Browser Rendering (Puppeteer) |
| **Database** | SQLite within Durable Objects |
| **AI Model** | Meta Llama-3-8B-Instruct |

## 📦 Installation & Setup

### 1. Clone & Install
```bash
git clone [https://github.com/your-username/watchit-v2.git](https://github.com/your-username/watchit-v2.git)
cd Trend-scraperV2
npm install
