import { fiatExtra } from "./fiat-extra.ts";
export type Kind = "fiat" | "crypto";
export type Currency = {
  id: string;
  kind: Kind;
  code: string;
  name: { en: string; ru: string };
  aliases: string[];
  symbols: string[];
  icon: string;
  metadataSource: string;
  /** Provider currency used for a local denomination with the same value. */
  fxCode?: string;
  binanceAsset?: string;
  pair?: string;
  krakenPair?: string;
};
const f = (
  code: string,
  en: string,
  ru: string,
  flag: string,
  aliases: string[] = [],
  symbols: string[] = [],
): Currency => ({
  id: `fiat:${code}`,
  kind: "fiat",
  code,
  name: { en, ru: ru.charAt(0).toLocaleUpperCase("ru") + ru.slice(1) },
  aliases,
  symbols,
  icon: `assets/${flag}.svg`,
  metadataSource: "Frankfurter v2; manually curated names and flag-icons",
});
const c = (
  code: string,
  en: string,
  ru: string,
  aliases: string[] = [],
  krakenPair?: string,
): Currency => ({
  id: `crypto:${code}`,
  kind: "crypto",
  code,
  name: { en, ru },
  aliases,
  symbols: [],
  icon: `assets/${code}.svg`,
  metadataSource: `Manually curated asset identity; Web3 Icons; ${krakenPair ? "Kraken" : "Binance"}`,
  binanceAsset: krakenPair ? undefined : code,
  pair: krakenPair || code === "USDT" ? undefined : `${code}USDT`,
  krakenPair,
});
const extraSymbols: Record<string, string[]> = {
  ARS: ["$"],
  CLP: ["$"],
  MXN: ["$"],
  COP: ["$"],
  UYU: ["$"],
  NZD: ["$"],
  SGD: ["$"],
  HKD: ["$"],
  TWD: ["$"],
  KRW: ["₩"],
  ILS: ["₪"],
  VND: ["₫"],
  THB: ["฿"],
  PHP: ["₱"],
  NGN: ["₦"],
};
export const catalog: Currency[] = [
  f(
    "RUB",
    "Russian Ruble",
    "Российский рубль",
    "ru",
    ["рубль", "рубля", "рублей", "руб", "руб.", "ruble", "rouble"],
    ["₽"],
  ),
  f(
    "USD",
    "US Dollar",
    "Доллар США",
    "us",
    ["доллар", "доллара", "долларов", "доллар сша", "dollar"],
    ["$"],
  ),
  f("EUR", "Euro", "Евро", "eu", ["евро", "euro"], ["€"]),
  f(
    "CNY",
    "Chinese Yuan",
    "Китайский юань",
    "cn",
    ["юань", "юаня", "юаней", "yuan"],
    ["¥"],
  ),
  f(
    "GBP",
    "British Pound",
    "Фунт стерлингов",
    "gb",
    ["фунт", "фунта", "фунтов", "pound"],
    ["£"],
  ),
  f("AED", "UAE Dirham", "Дирхам ОАЭ", "ae", [
    "дирхам",
    "дирхама",
    "дирхамов",
    "dirham",
  ]),
  f(
    "TRY",
    "Turkish Lira",
    "Турецкая лира",
    "tr",
    ["лира", "лиры", "лир", "lira"],
    ["₺"],
  ),
  f(
    "KZT",
    "Kazakhstani Tenge",
    "Казахстанский тенге",
    "kz",
    ["тенге", "tenge"],
    ["₸"],
  ),
  f("CAD", "Canadian Dollar", "Канадский доллар", "ca", [], ["$"]),
  f("AUD", "Australian Dollar", "Австралийский доллар", "au", [], ["$"]),
  f(
    "JPY",
    "Japanese Yen",
    "Японская иена",
    "jp",
    ["иена", "иены", "yen"],
    ["¥"],
  ),
  f("CHF", "Swiss Franc", "Швейцарский франк", "ch", ["франк", "franc"]),
  f("INR", "Indian Rupee", "Индийская рупия", "in", [], ["₹"]),
  f("BRL", "Brazilian Real", "Бразильский реал", "br", [], ["R$"]),
  f("UAH", "Ukrainian Hryvnia", "Украинская гривна", "ua", [], ["₴"]),
  f("BYN", "Belarusian Ruble", "Белорусский рубль", "by"),
  f("GEL", "Georgian Lari", "Грузинский лари", "ge"),
  f("PLN", "Polish Zloty", "Польский злотый", "pl"),
  ...fiatExtra.map(([code, en, ru, flag]) =>
    f(code, en, ru, flag, [], extraSymbols[code] || []),
  ),
  {
    ...f("TVD", "Tuvaluan Dollar (AUD 1:1)", "Доллар Тувалу (AUD 1:1)", "tv"),
    fxCode: "AUD",
    metadataSource:
      "AUD denomination; https://www.dfat.gov.au/geo/tuvalu/tuvalu-country-brief; flag-icons",
  },
  c("BTC", "Bitcoin", "Биткоин", ["биткоина", "биткоинов", "bitcoin"]),
  c("ETH", "Ethereum", "Эфириум", ["эфир", "эфира", "ethereum"]),
  c("USDT", "Tether USD", "Tether USD", ["tether"]),
  c("USDC", "USD Coin", "USD Coin"),
  c("BNB", "BNB", "BNB"),
  c("SOL", "Solana", "Solana"),
  c("XRP", "XRP", "XRP"),
  c("TRX", "Tron", "Tron"),
  c("AAVE", "Aave", "Aave"),
  c("ADA", "Cardano", "Cardano"),
  c("APE", "ApeCoin", "ApeCoin"),
  c("APT", "Aptos", "Aptos"),
  c("ARB", "Arbitrum", "Arbitrum"),
  c("AVAX", "Avalanche", "Avalanche"),
  c("BCH", "Bitcoin Cash", "Bitcoin Cash"),
  c("DASH", "Dash", "Dash"),
  c("DOGE", "Dogecoin", "Dogecoin"),
  c("ETC", "Ethereum Classic", "Ethereum Classic"),
  c("FIL", "Filecoin", "Filecoin"),
  c("HBAR", "Hedera", "Hedera"),
  {
    ...c("INJ", "Injective", "Injective"),
    metadataSource:
      "Injective official brand assets: https://injective.com/brand; Binance",
  },
  c("LINK", "Chainlink", "Chainlink"),
  c("LTC", "Litecoin", "Litecoin"),
  c("LUNA", "Terra", "Terra"),
  c("LUNC", "Terra Classic", "Terra Classic"),
  c("PEPE", "Pepe", "Pepe"),
  c("SHIB", "Shiba Inu", "Shiba Inu"),
  c("UNI", "Uniswap", "Uniswap"),
  c("VET", "VeChain", "VeChain"),
  c("XAUT", "Tether Gold", "Tether Gold"),
  c("XLM", "Stellar", "Stellar"),
  c("ZEC", "Zcash", "Zcash"),
  c("ZIL", "Zilliqa", "Zilliqa"),
  c("TON", "Toncoin", "Тонкоин", ["тон", "toncoin"], "TONUSDT"),
  c("XMR", "Monero", "Монеро", ["monero"], "XMRUSDT"),
];
const currenciesByCode = new Map(
  catalog.map((currency) => [currency.code, currency]),
);
export const byCode = (code: string) => currenciesByCode.get(code)!;
export const tables: Record<Kind, string[]> = {
  fiat: ["RUB", "USD", "EUR", "CNY", "GBP", "AED", "TRY", "KZT"],
  crypto: ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "XRP", "TRX"],
};
export const normalize = (x: string) =>
  x.normalize("NFKC").toLocaleLowerCase().replace(/ё/g, "е").trim();

export const rateTable = [...tables.fiat, "BTC", "ETH", "USDT"];
