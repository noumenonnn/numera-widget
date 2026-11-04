import { writeFile } from "node:fs/promises";
import { catalog } from "../src/catalog.ts";
const currencies = catalog.map(({ icon, pair, ...currency }) => ({
  ...currency,
  iconPath: icon,
  ...(pair ? { binanceUsdtPair: pair } : {}),
}));
await writeFile(
  "public/currency-catalog.json",
  JSON.stringify({ version: 1, currencies }, null, 2) + "\n",
);
