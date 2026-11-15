import { byCode, catalog, normalize, type Currency } from "./catalog";
import { countryData } from "./country-data";

// Normalize punctuation in abbreviations and country names, but never remove words.
const countryKey = (text: string) =>
  normalize(text)
    .normalize("NFD")
    .replace(/([a-z])\p{M}+/gu, "$1")
    .normalize("NFC")
    .replace(/[.’']/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ");
const aliases = new Map<string, Set<string>>();
const add = (names: readonly string[], codes: readonly string[]) => {
  for (const name of names) {
    const key = countryKey(name);
    const existing = aliases.get(key) ?? new Set<string>();
    codes.forEach((code) => existing.add(code));
    aliases.set(key, existing);
  }
};
for (const [region, codes, en, ru] of countryData) add([region, en, ru], codes);

const extraAliases: ReadonlyArray<
  readonly [readonly string[], readonly string[]]
> = [
  [
    [
      "РФ",
      "Р. Ф.",
      "Российская Федерация",
      "Russia",
      "Russian Federation",
      "Rossiya",
      "Rossia",
    ],
    ["RUB"],
  ],
  [
    [
      "США",
      "С. Ш. А.",
      "USA",
      "U.S.A.",
      "U. S.",
      "Соединенные Штаты",
      "Соединенные Штаты Америки",
      "United States of America",
      "America",
      "Америка",
      "Штаты",
    ],
    ["USD"],
  ],
  [
    ["РБ", "Республика Беларусь", "Belorussia", "Belarus", "Belarussia"],
    ["BYN"],
  ],
  [
    [
      "UK",
      "U.K.",
      "Великобритания",
      "Британия",
      "Англия",
      "England",
      "Britain",
      "Great Britain",
    ],
    ["GBP"],
  ],
  [
    [
      "КНР",
      "Китайская Народная Республика",
      "PRC",
      "People's Republic of China",
    ],
    ["CNY"],
  ],
  [["ОАЭ", "UAE", "U.A.E.", "Эмираты", "Арабские Эмираты"], ["AED"]],
  [["РК", "Республика Казахстан"], ["KZT"]],
  [
    [
      "Киргизия",
      "Киргизстан",
      "Кыргызстан",
      "Кыргызская Республика",
      "Kirgizia",
    ],
    ["KGS"],
  ],
  [["ЮАР", "RSA", "Южно-Африканская Республика"], ["ZAR"]],
  [["Южная Корея", "Республика Корея", "South Korea"], ["KRW"]],
  [["Северная Корея", "КНДР", "North Korea", "DPRK"], ["KPW"]],
  [
    ["Корея", "Korea"],
    ["KRW", "KPW"],
  ],
  [["Еврозона", "Eurozone", "Euro area"], ["EUR"]],
  [["ФРГ", "Deutschland"], ["EUR"]],
  [["Голландия", "Holland"], ["EUR"]],
  [["Турция", "Turkey", "Turkiye"], ["TRY"]],
  [["Чехия", "Czech Republic"], ["CZK"]],
  [["Молдавия", "Republic of Moldova"], ["MDL"]],
  [["Гонконг", "Hongkong"], ["HKD"]],
  [["Новая Зеландия", "NZ"], ["NZD"]],
];
for (const [names, codes] of extraAliases) add(names, codes);
// Common ISO alpha-3 country codes, distinct from three-letter currency codes.
for (const [name, code] of Object.entries({
  RUS: "RUB",
  BLR: "BYN",
  UKR: "UAH",
  GBR: "GBP",
  CHN: "CNY",
  ARE: "AED",
  KAZ: "KZT",
  ARM: "AMD",
  AZE: "AZN",
  GEO: "GEL",
  KGZ: "KGS",
  UZB: "UZS",
  TJK: "TJS",
  CAN: "CAD",
  AUS: "AUD",
  NZL: "NZD",
  JPN: "JPY",
  IND: "INR",
  DEU: "EUR",
  FRA: "EUR",
  ITA: "EUR",
  ESP: "EUR",
  POL: "PLN",
  TUR: "TRY",
  CHE: "CHF",
  BRA: "BRL",
  KOR: "KRW",
  PRK: "KPW",
}))
  add([name], [code]);

// Anchored, curated inflections/typos: no arbitrary fuzzy match or substring guessing.
const forms: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/^(?:рос{1,2}и{1,2}(?:я|и|ю|ей)|российск(?:ая|ой|ую|ие|их))$/u, ["RUB"]],
  [
    /^(?:бел(?:а|о)рус{1,2}(?:ь|и|ью|ия|ии|ию)|белорусск(?:ая|ой|ую|ие|их))$/u,
    ["BYN"],
  ],
  [/^(?:америк(?:а|и|у|ой)|американск(?:ая|ой|ую|ие|их))$/u, ["USD"]],
  [/^(?:украин(?:а|ы|е|у|ой)|украинск(?:ая|ой|ую|ие|их))$/u, ["UAH"]],
  [/^(?:казахстан(?:а|е|ом)?|казахстанск(?:ая|ой|ую|ие|их))$/u, ["KZT"]],
  [/^(?:грузи(?:я|и|ю|ей)|грузинск(?:ая|ой|ую|ие|их))$/u, ["GEL"]],
  [/^(?:армени(?:я|и|ю|ей)|армянск(?:ая|ой|ую|ие|их))$/u, ["AMD"]],
  [/^(?:турци(?:я|и|ю|ей)|турецк(?:ая|ой|ую|ие|их))$/u, ["TRY"]],
  [/^(?:кита(?:й|я|е|ем)|китайск(?:ая|ой|ую|ие|их))$/u, ["CNY"]],
  [/^(?:япони(?:я|и|ю|ей)|японск(?:ая|ой|ую|ие|их))$/u, ["JPY"]],
  [/^(?:канад(?:а|ы|е|у|ой)|канадск(?:ая|ой|ую|ие|их))$/u, ["CAD"]],
  [/^(?:австрали(?:я|и|ю|ей)|австралийск(?:ая|ой|ую|ие|их))$/u, ["AUD"]],
  [/^(?:польш(?:а|и|е|у|ей)|польск(?:ая|ой|ую|ие|их))$/u, ["PLN"]],
  [
    /^(?:германи(?:я|и|ю|ей)|франци(?:я|и|ю|ей)|итали(?:я|и|ю|ей)|испани(?:я|и|ю|ей))$/u,
    ["EUR"],
  ],
];

function lookup(token: string): Set<string> {
  // Lowercase "kr" is a currency abbreviation, not a reliable country label.
  if (countryKey(token) === "kr" && token.trim() !== "KR") return new Set();
  const key = countryKey(token).replace(
    /^(?:в|из|для|страна|in|from|country)\s+/u,
    "",
  );
  const codes = new Set(aliases.get(key));
  for (const [pattern, matches] of forms)
    if (pattern.test(key)) matches.forEach((c) => codes.add(c));
  return codes;
}

/** Exact country input, optionally qualified by a currency (e.g. "USD Panama"). */
export function countryCurrencies(token: string): Currency[] {
  const direct = lookup(token);
  if (direct.size) return [...direct].map(byCode).filter(Boolean);
  const candidates = new Set<string>();
  const parts = token.trim().split(/\s+/u);
  for (let i = 1; i < parts.length; i++) {
    const left = parts.slice(0, i).join(" "),
      right = parts.slice(i).join(" ");
    for (const [country, denomination] of [
      [left, right],
      [right, left],
    ]) {
      const codes = lookup(country);
      const name = normalize(denomination);
      for (const code of codes) {
        const currency = byCode(code);
        if (!currency) continue;
        const exact = [
          currency.code,
          ...currency.aliases,
          ...currency.symbols,
          currency.name.en,
          currency.name.ru,
        ].some((a) => normalize(a) === name);
        const family =
          (/^(?:руб\.?|рубл(?:ь|я|ей|и)|rou?bles?)$/u.test(name) &&
            /ruble/i.test(currency.name.en)) ||
          (/^(?:\$|доллар(?:а|ов|ы)?|dollars?)$/u.test(name) &&
            /dollar/i.test(currency.name.en));
        if (exact || family) candidates.add(code);
      }
    }
  }
  return catalog.filter((c) => candidates.has(c.code));
}
