import { catalog, type Currency } from "./catalog";

// Categories are ordered independently of the provider's catalog order.
export const currencyGroups = [
  {
    name: "Major currencies",
    ru: "Основные валюты",
    codes: "RUB USD EUR CNY GBP AED TRY KZT JPY CHF CAD AUD",
  },
  {
    name: "Europe",
    ru: "Европа",
    codes:
      "UAH BYN PLN CZK DKK SEK NOK HUF ISK RON RSD MDL BAM ALL GIP IMP JEP MKD",
  },
  {
    name: "North America",
    ru: "Северная Америка",
    codes: "MXN BZD CRC GTQ HNL NIO PAB SVC",
  },
  {
    name: "South America",
    ru: "Южная Америка",
    codes: "BRL ARS CLP COP PEN UYU FKP BOB GYD PYG SRD VES",
  },
  {
    name: "Asia",
    ru: "Азия",
    codes:
      "INR GEL AMD AZN UZS KGS TJS TMT PKR BDT LKR NPR THB VND IDR MYR SGD HKD TWD KRW PHP MNT KHR LAK AFN BND KPW MMK MOP MVR",
  },
  {
    name: "Middle East",
    ru: "Ближний Восток",
    codes: "SAR QAR KWD BHD OMR ILS JOD IQD IRR LBP SYP YER",
  },
  {
    name: "Africa",
    ru: "Африка",
    codes:
      "EGP MAD ZAR NGN KES GHS ETB TZS UGX DZD TND SHP AOA BIF BWP CDF DJF GMD GNF KMF LRD LYD MGA MRU MUR MWK MZN NAD RWF SCR SDG SLE SOS SZL ZMW",
  },
  { name: "Oceania", ru: "Океания", codes: "FJD NZD PGK SBD TVD VUV WST XPF" },
  {
    name: "Caribbean",
    ru: "Карибский регион",
    codes: "AWG BBD BMD BSD CUP DOP HTG JMD KYD TTD",
  },
  {
    name: "Crypto",
    ru: "Криптовалюты",
    codes:
      "BTC ETH USDT USDC BNB SOL XRP TRX AAVE ADA APE APT ARB AVAX BCH DASH DOGE ETC FIL HBAR INJ LINK LTC LUNA LUNC PEPE SHIB UNI VET XAUT XLM ZEC ZIL TON XMR",
  },
] as const;

const groupByCode = new Map(
  currencyGroups.flatMap((group, index) =>
    group.codes
      .split(" ")
      .filter(Boolean)
      .map((code) => [code, index] as const),
  ),
);
export const currencyGroup = (currency: Currency) =>
  currencyGroups[groupByCode.get(currency.code)!];
export const pickerCurrencies = [...catalog].sort(
  (a, b) => groupByCode.get(a.code)! - groupByCode.get(b.code)!,
);
