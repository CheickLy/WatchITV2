import { DurableObject } from "cloudflare:workers";

export class PriceWatcher extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Initialize the SQLite table
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        price REAL,
        timestamp INTEGER
      )
    `);
  }

  async recordPrice(price: number) {
    const timestamp = Date.now();
    // Insert using bindings to prevent injection
    this.ctx.storage.sql.exec(
      "INSERT INTO price_history (price, timestamp) VALUES (?, ?)",
      price, 
      timestamp
    );
  }

  async getHistory() {
    // Return last 10 entries as an array
    const result = this.ctx.storage.sql.exec(
      "SELECT * FROM price_history ORDER BY timestamp DESC LIMIT 10"
    );
    return result.toArray();
  }
}