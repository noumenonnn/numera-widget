import { writeFile, copyFile } from "node:fs/promises";
const pairs = [
  ["ARS", "ar"],
  ["CLP", "cl"],
  ["MXN", "mx"],
  ["COP", "co"],
  ["PEN", "pe"],
  ["UYU", "uy"],
  ["CZK", "cz"],
  ["DKK", "dk"],
  ["SEK", "se"],
  ["NOK", "no"],
  ["HUF", "hu"],
  ["ISK", "is"],
  ["RON", "ro"],
  ["RSD", "rs"],
  ["AMD", "am"],
  ["AZN", "az"],
  ["UZS", "uz"],
  ["KGS", "kg"],
  ["TJS", "tj"],
  ["TMT", "tm"],
  ["MDL", "md"],
  ["PKR", "pk"],
  ["BDT", "bd"],
  ["LKR", "lk"],
  ["NPR", "np"],
  ["THB", "th"],
  ["VND", "vn"],
  ["IDR", "id"],
  ["MYR", "my"],
  ["SGD", "sg"],
  ["HKD", "hk"],
  ["TWD", "tw"],
  ["KRW", "kr"],
  ["PHP", "ph"],
  ["SAR", "sa"],
  ["QAR", "qa"],
  ["KWD", "kw"],
  ["BHD", "bh"],
  ["OMR", "om"],
  ["ILS", "il"],
  ["JOD", "jo"],
  ["EGP", "eg"],
  ["MAD", "ma"],
  ["ZAR", "za"],
  ["NGN", "ng"],
  ["KES", "ke"],
  ["GHS", "gh"],
  ["ETB", "et"],
  ["TZS", "tz"],
  ["UGX", "ug"],
  ["NZD", "nz"],
  ["DZD", "dz"],
  ["TND", "tn"],
  ["BAM", "ba"],
  ["ALL", "al"],
  ["MNT", "mn"],
  ["KHR", "kh"],
  ["LAK", "la"],
];
const en = new Intl.DisplayNames("en", { type: "currency" }),
  ru = new Intl.DisplayNames("ru", { type: "currency" });
const rows = [];
for (const [code, flag] of pairs) {
  const nameEn = en.of(code),
    nameRu = ru.of(code);
  if (!nameEn || !nameRu || nameEn === code || nameRu === code)
    throw Error(`Missing name ${code}`);
  await copyFile(
    `node_modules/flag-icons/flags/4x3/${flag}.svg`,
    `public/assets/${flag}.svg`,
  );
  rows.push([code, nameEn, nameRu, flag]);
}
await writeFile(
  "src/fiat-extra.ts",
  `// Curated active currencies with local flag-icons; names generated using Unicode CLDR (Node 24).\nexport const fiatExtra: ReadonlyArray<readonly [string,string,string,string]> = ${JSON.stringify(rows, null, 2)};\n`,
);
console.log(rows.length);
