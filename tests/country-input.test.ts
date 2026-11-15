import { expect, it } from "vitest";
import { byCode } from "../src/catalog";
import { countryData } from "../src/country-data";
import { parseInput } from "../src/engine";
import { parseSelection } from "../src/selection-conversion";

it.each([
  ["100 РФ", "RUB"],
  ["Р. Ф. 100", "RUB"],
  ["100 рф", "RUB"],
  ["100 Россия", "RUB"],
  ["100 России", "RUB"],
  ["100 Россиия", "RUB"],
  ["100 Росия", "RUB"],
  ["100 из России", "RUB"],
  ["100 российских", "RUB"],
  ["США 25", "USD"],
  ["25 сша", "USD"],
  ["25 U.S.A.", "USD"],
  ["25 Соединенные Штаты Америки", "USD"],
  ["25 United States", "USD"],
  ["50 Беларусь", "BYN"],
  ["50 Белоруссия", "BYN"],
  ["50 Беларуси", "BYN"],
  ["50 белорусских", "BYN"],
  ["50 Республика Беларусь", "BYN"],
  ["50 РБ", "BYN"],
  ["50 Belarus", "BYN"],
  ["50 Belorussia", "BYN"],
  ["100 руб Беларуси", "BYN"],
  ["100 долларов Канады", "CAD"],
  ["100 USD Panama", "USD"],
  ["100 Panama PAB", "PAB"],
  ["100 UK", "GBP"],
  ["100 ОАЭ", "AED"],
  ["100 КНР", "CNY"],
  ["100 Кыргызстан", "KGS"],
  ["100 Киргизия", "KGS"],
  ["100 Турция", "TRY"],
  ["100 Türkiye", "TRY"],
  ["100 Германия", "EUR"],
  ["100 Болгария", "EUR"],
  ["100 Южная Корея", "KRW"],
  ["100 КНДР", "KPW"],
  ["100 RUS", "RUB"],
  ["100 BLR", "BYN"],
  ["100 UKR", "UAH"],
  ["100 DEU", "EUR"],
])("recognizes country input %s as %s", (input, code) => {
  expect(parseInput(input, byCode("BTC"))).toMatchObject({
    status: "valid",
    currency: { code },
  });
});

it.each(countryData)(
  "recognizes the catalog country %s in both languages and ISO form",
  (region, codes, en, ru) => {
    for (const name of [region, en, ru]) {
      const parsed = parseInput(`12.5 ${name}`, byCode("BTC"), true);
      expect(parsed).toMatchObject({ amount: "12.5" });
      if (codes.length === 1)
        expect(parsed).toMatchObject({
          status: "valid",
          currency: { code: codes[0] },
        });
      else {
        expect(parsed.status).toBe("ambiguous");
        if (parsed.status === "ambiguous")
          expect(parsed.choices.map((c) => c.code)).toEqual(codes);
      }
    }
  },
);

it.each([
  ["Панама", ["PAB", "USD"]],
  ["Namibia", ["NAD", "ZAR"]],
  ["Тувалу", ["TVD", "AUD"]],
  ["Корея", ["KRW", "KPW"]],
])(
  "offers country chips for %s even when the row already uses a candidate",
  (name, codes) => {
    const parsed = parseInput(`100 ${name}`, byCode(codes[0]), true);
    expect(parsed.status).toBe("ambiguous");
    if (parsed.status === "ambiguous")
      expect(parsed.choices.map((c) => c.code)).toEqual(codes);
  },
);

it.each([
  "100 Российский сайт",
  "100 Росс",
  "100 USAfoo",
  "100 из неизвестной страны",
  "100 USD Россия",
  "100 Россия США",
  "РФ",
  "10+20 РФ",
  "100 Руандаxyz",
])(
  "does not guess country fragments or conflicting expressions: %s",
  (input) => {
    expect(parseInput(input, byCode("BTC"), true).status).not.toBe("valid");
  },
);

it("preserves number grammar and exact amounts with country labels", () => {
  expect(parseInput("-1 234,56 РФ", byCode("BTC"))).toMatchObject({
    status: "valid",
    amount: "-1234.56",
    currency: { code: "RUB" },
  });
  expect(parseInput("Беларусь 1e-8", byCode("BTC"))).toMatchObject({
    status: "valid",
    amount: "0.00000001",
    currency: { code: "BYN" },
  });
  expect(parseInput("12 34 США", byCode("BTC"), true).status).toBe("invalid");
});

it("supports complete country-labelled page selections without guessing multiple currencies", () => {
  expect(parseSelection("30 РФ")).toEqual({ amount: "30", code: "RUB" });
  expect(parseSelection("Беларусь 50")).toEqual({ amount: "50", code: "BYN" });
  expect(parseSelection("100 Панама")).toBeNull();
  expect(parseSelection("100 Корея")).toBeNull();
});
