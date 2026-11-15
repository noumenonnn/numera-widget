# Country input

Amounts accept exact country/territory names in Russian and English, ISO alpha-2
codes, curated abbreviations, Russian case endings and a limited list of common
spelling variants. Examples: `100 РФ`, `США 25`, `100 Россиия`, `50 Беларусь`,
`100 руб Беларуси`, `100 USD Panama`.

The checked-in labels in `src/country-data.ts` come from Unicode CLDR via Node 24
`Intl.DisplayNames`. The base mapping uses the existing currency catalog's country
flags. Euro-area countries map to EUR, including Bulgaria from 2026-01-01.
No online lookup is needed during input.

Names must match the entire country token. Regexes are anchored; there is no
general fuzzy matching or substring detection. Conflicting qualifiers and unknown
countries remain unresolved. Country candidates always show chips when more than
one currency matches, even when the current row uses one of those currencies.
The selection tooltip can use a complete country-labelled amount only when the
currency is unambiguous; it does not choose a country candidate on the user's behalf.

Multi-currency mappings cover supported currencies only:

- Panama: PAB and USD. [Government financial education portal](https://tubalboaconsentido.gob.pa/sistema-financiero/).
- Namibia: NAD and ZAR. [Bank of Namibia](https://www.bon.com.na/Informations/FAQ/Exchange-Control.aspx).
- Tuvalu: TVD and AUD (local AUD denomination, as already documented in the catalog).
- `Корея` / `Korea`: KRW and KPW; specifying North/South resolves the country.

Euro membership: [European Central Bank](https://www.ecb.europa.eu/euro/intro/html/index.en.html).
Mappings reviewed 2026-11-15. This list is input assistance, not a complete list
of every currency accepted by shops or payment services in each territory.
