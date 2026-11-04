# Сверка каталога валют

Проверено 4 ноября 2026 года по кодам, читаемым на предоставленных скриншотах. Скриншоты используются как информационный список.

Всего: 188 кодов. Уже было: 99. Добавлено: 79. Не добавлено: 10. После расширения: 145 фиатных валют и 35 криптовалют.

В криптовалютных скриншотах читаются 42 кода при заголовке «43». XRP уже есть у нас, но на присланных кадрах не виден. LINK присутствует на шестом кадре и добавлен. ALL и XRP сохранены сверх списка.

| Группа на скриншоте | Всего | Уже было | Добавлено | Не добавлено |
|---|---:|---:|---:|---:|
| Major currencies | 15 | 15 | 0 | 0 |
| Europe | 20 | 13 | 6 | 1 |
| North America | 9 | 1 | 7 | 1 |
| South America | 11 | 6 | 5 | 0 |
| Asia | 25 | 19 | 6 | 0 |
| Middle East | 14 | 9 | 5 | 0 |
| Africa | 34 | 11 | 23 | 0 |
| Oceania | 8 | 8 | 0 | 0 |
| Caribbean | 10 | 10 | 0 | 0 |
| Crypto | 42 | 7 | 27 | 8 |

TON и XMR подключены через Kraken: котировки TON/USDT и XMR/USDT загружаются одним запросом вместе с USDT/USD. Проверены реальным запросом.

## Исключения

- BGN: Болгария перешла на евро 1 января 2026 года; текущих котировок в проверенном ответе Frankfurter нет. Историческая конверсия требует отдельной реализации.
- MXV: Mexican Investment Unit отсутствует в текущем ответе Frankfurter. Нужен отдельный источник UDI; заменять MXN нельзя.
- BTG, BUSD, CRO, DAI, GUSD, KAS, LEO, OKB: нет активной спотовой пары USDT в проверенном Binance exchangeInfo. Для BTG, BUSD и DAI найдены пары со статусом BREAK; для остальных подходящей пары нет. Нужен другой источник или проверенная альтернативная пара. Это ограничение текущего подключения, а не утверждение об отсутствии рыночной цены.
- USDT уже поддержан как базовая единица криптовалютных котировок; собственная пара USDT/USDT не нужна. Курс USDT/USD берётся из Kraken.
- TVD уже поддержан через AUD с явной пометкой AUD 1:1.

Группы ниже соответствуют скриншотам для удобства сверки. В приложении сохранена существующая группировка; новые FKP и SHP относятся к Южной Америке и Африке соответственно.

## Major currencies

| Код | Статус | Источник / примечание |
|---|---|---|
| AUD | Уже был | Frankfurter, 2026-11-04 |
| CAD | Уже был | Frankfurter, 2026-11-04 |
| CHF | Уже был | Frankfurter, 2026-11-04 |
| CNY | Уже был | Frankfurter, 2026-11-04 |
| DKK | Уже был | Frankfurter, 2026-11-04 |
| EUR | Уже был | Frankfurter, 2026-11-05 |
| GBP | Уже был | Frankfurter, 2026-11-05 |
| INR | Уже был | Frankfurter, 2026-11-04 |
| JPY | Уже был | Frankfurter, 2026-11-04 |
| KRW | Уже был | Frankfurter, 2026-11-04 |
| MDL | Уже был | Frankfurter, 2026-11-04 |
| RON | Уже был | Frankfurter, 2026-11-04 |
| RUB | Уже был | Frankfurter, 2026-11-04 |
| SGD | Уже был | Frankfurter, 2026-11-04 |
| USD | Уже был | Frankfurter, 2026-11-05 |

## Europe

| Код | Статус | Источник / примечание |
|---|---|---|
| AMD | Уже был | Frankfurter, 2026-11-04 |
| AZN | Уже был | Frankfurter, 2026-11-04 |
| BAM | Уже был | Frankfurter, 2026-11-04 |
| BGN | Не добавлен | Выведен из обращения |
| BYN | Уже был | Frankfurter, 2026-11-04 |
| CZK | Уже был | Frankfurter, 2026-11-04 |
| FKP | Добавлен | Frankfurter, 2026-11-03 |
| GEL | Уже был | Frankfurter, 2026-11-04 |
| GIP | Добавлен | Frankfurter, 2026-11-04 |
| HUF | Уже был | Frankfurter, 2026-11-04 |
| IMP | Добавлен | Frankfurter, 2026-11-05 |
| ISK | Уже был | Frankfurter, 2026-11-04 |
| JEP | Добавлен | Frankfurter, 2026-11-05 |
| MKD | Добавлен | Frankfurter, 2026-11-04 |
| NOK | Уже был | Frankfurter, 2026-11-04 |
| PLN | Уже был | Frankfurter, 2026-11-04 |
| RSD | Уже был | Frankfurter, 2026-11-04 |
| SEK | Уже был | Frankfurter, 2026-11-04 |
| SHP | Добавлен | Frankfurter, 2026-11-03 |
| UAH | Уже был | Frankfurter, 2026-11-04 |

## North America

| Код | Статус | Источник / примечание |
|---|---|---|
| BZD | Добавлен | Frankfurter, 2026-11-04 |
| CRC | Добавлен | Frankfurter, 2026-11-04 |
| GTQ | Добавлен | Frankfurter, 2026-11-04 |
| HNL | Добавлен | Frankfurter, 2026-11-04 |
| MXN | Уже был | Frankfurter, 2026-11-04 |
| MXV | Не добавлен | Нужен источник UDI |
| NIO | Добавлен | Frankfurter, 2026-11-04 |
| PAB | Добавлен | Frankfurter, 2026-11-04 |
| SVC | Добавлен | Frankfurter, 2026-11-04 |

## South America

| Код | Статус | Источник / примечание |
|---|---|---|
| ARS | Уже был | Frankfurter, 2026-11-04 |
| BOB | Добавлен | Frankfurter, 2026-11-04 |
| BRL | Уже был | Frankfurter, 2026-11-04 |
| CLP | Уже был | Frankfurter, 2026-11-04 |
| COP | Уже был | Frankfurter, 2026-11-04 |
| GYD | Добавлен | Frankfurter, 2026-11-04 |
| PEN | Уже был | Frankfurter, 2026-11-04 |
| PYG | Добавлен | Frankfurter, 2026-11-04 |
| SRD | Добавлен | Frankfurter, 2026-11-04 |
| UYU | Уже был | Frankfurter, 2026-11-04 |
| VES | Добавлен | Frankfurter, 2026-11-04 |

## Asia

| Код | Статус | Источник / примечание |
|---|---|---|
| AFN | Добавлен | Frankfurter, 2026-11-04 |
| BDT | Уже был | Frankfurter, 2026-11-04 |
| BND | Добавлен | Frankfurter, 2026-11-04 |
| HKD | Уже был | Frankfurter, 2026-11-04 |
| IDR | Уже был | Frankfurter, 2026-11-04 |
| KGS | Уже был | Frankfurter, 2026-11-04 |
| KHR | Уже был | Frankfurter, 2026-11-04 |
| KPW | Добавлен | Frankfurter, 2026-11-04 |
| KZT | Уже был | Frankfurter, 2026-11-04 |
| LAK | Уже был | Frankfurter, 2026-11-04 |
| LKR | Уже был | Frankfurter, 2026-11-04 |
| MMK | Добавлен | Frankfurter, 2026-11-04 |
| MNT | Уже был | Frankfurter, 2026-11-04 |
| MOP | Добавлен | Frankfurter, 2026-11-04 |
| MVR | Добавлен | Frankfurter, 2026-11-04 |
| MYR | Уже был | Frankfurter, 2026-11-04 |
| NPR | Уже был | Frankfurter, 2026-11-04 |
| PHP | Уже был | Frankfurter, 2026-11-04 |
| PKR | Уже был | Frankfurter, 2026-11-04 |
| THB | Уже был | Frankfurter, 2026-11-04 |
| TJS | Уже был | Frankfurter, 2026-11-04 |
| TMT | Уже был | Frankfurter, 2026-11-04 |
| TWD | Уже был | Frankfurter, 2026-11-04 |
| UZS | Уже был | Frankfurter, 2026-11-04 |
| VND | Уже был | Frankfurter, 2026-11-04 |

## Middle East

| Код | Статус | Источник / примечание |
|---|---|---|
| AED | Уже был | Frankfurter, 2026-11-04 |
| BHD | Уже был | Frankfurter, 2026-11-04 |
| ILS | Уже был | Frankfurter, 2026-11-04 |
| IQD | Добавлен | Frankfurter, 2026-11-04 |
| IRR | Добавлен | Frankfurter, 2026-11-04 |
| JOD | Уже был | Frankfurter, 2026-11-04 |
| KWD | Уже был | Frankfurter, 2026-11-04 |
| LBP | Добавлен | Frankfurter, 2026-11-04 |
| OMR | Уже был | Frankfurter, 2026-11-04 |
| QAR | Уже был | Frankfurter, 2026-11-04 |
| SAR | Уже был | Frankfurter, 2026-11-04 |
| SYP | Добавлен | Frankfurter, 2026-11-04 |
| TRY | Уже был | Frankfurter, 2026-11-04 |
| YER | Добавлен | Frankfurter, 2026-11-04 |

## Africa

| Код | Статус | Источник / примечание |
|---|---|---|
| AOA | Добавлен | Frankfurter, 2026-11-04 |
| BIF | Добавлен | Frankfurter, 2026-11-04 |
| BWP | Добавлен | Frankfurter, 2026-11-04 |
| CDF | Добавлен | Frankfurter, 2026-11-04 |
| DJF | Добавлен | Frankfurter, 2026-11-04 |
| DZD | Уже был | Frankfurter, 2026-11-04 |
| EGP | Уже был | Frankfurter, 2026-11-04 |
| ETB | Уже был | Frankfurter, 2026-11-04 |
| GHS | Уже был | Frankfurter, 2026-11-04 |
| GMD | Добавлен | Frankfurter, 2026-11-04 |
| GNF | Добавлен | Frankfurter, 2026-11-04 |
| KES | Уже был | Frankfurter, 2026-11-04 |
| KMF | Добавлен | Frankfurter, 2026-11-04 |
| LRD | Добавлен | Frankfurter, 2026-11-04 |
| LYD | Добавлен | Frankfurter, 2026-11-04 |
| MAD | Уже был | Frankfurter, 2026-11-04 |
| MGA | Добавлен | Frankfurter, 2026-11-04 |
| MRU | Добавлен | Frankfurter, 2026-11-04 |
| MUR | Добавлен | Frankfurter, 2026-11-04 |
| MWK | Добавлен | Frankfurter, 2026-11-04 |
| MZN | Добавлен | Frankfurter, 2026-11-04 |
| NAD | Добавлен | Frankfurter, 2026-11-04 |
| NGN | Уже был | Frankfurter, 2026-11-04 |
| RWF | Добавлен | Frankfurter, 2026-11-04 |
| SCR | Добавлен | Frankfurter, 2026-11-05 |
| SDG | Добавлен | Frankfurter, 2026-11-04 |
| SLE | Добавлен | Frankfurter, 2026-11-04 |
| SOS | Добавлен | Frankfurter, 2026-11-04 |
| SZL | Добавлен | Frankfurter, 2026-11-04 |
| TND | Уже был | Frankfurter, 2026-11-04 |
| TZS | Уже был | Frankfurter, 2026-11-04 |
| UGX | Уже был | Frankfurter, 2026-11-04 |
| ZAR | Уже был | Frankfurter, 2026-11-04 |
| ZMW | Добавлен | Frankfurter, 2026-11-04 |

## Oceania

| Код | Статус | Источник / примечание |
|---|---|---|
| FJD | Уже был | Frankfurter, 2026-11-04 |
| NZD | Уже был | Frankfurter, 2026-11-04 |
| PGK | Уже был | Frankfurter, 2026-11-04 |
| SBD | Уже был | Frankfurter, 2026-11-04 |
| TVD | Уже был | AUD 1:1 |
| VUV | Уже был | Frankfurter, 2026-11-04 |
| WST | Уже был | Frankfurter, 2026-11-04 |
| XPF | Уже был | Frankfurter, 2026-11-04 |

## Caribbean

| Код | Статус | Источник / примечание |
|---|---|---|
| AWG | Уже был | Frankfurter, 2026-11-04 |
| BBD | Уже был | Frankfurter, 2026-11-04 |
| BMD | Уже был | Frankfurter, 2026-11-04 |
| BSD | Уже был | Frankfurter, 2026-11-04 |
| CUP | Уже был | Frankfurter, 2026-11-04 |
| DOP | Уже был | Frankfurter, 2026-11-04 |
| HTG | Уже был | Frankfurter, 2026-11-04 |
| JMD | Уже был | Frankfurter, 2026-11-04 |
| KYD | Уже был | Frankfurter, 2026-11-04 |
| TTD | Уже был | Frankfurter, 2026-11-04 |

## Crypto

| Код | Статус | Источник / примечание |
|---|---|---|
| AAVE | Добавлен | AAVEUSDT |
| ADA | Добавлен | ADAUSDT |
| APE | Добавлен | APEUSDT |
| APT | Добавлен | APTUSDT |
| ARB | Добавлен | ARBUSDT |
| AVAX | Добавлен | AVAXUSDT |
| BCH | Добавлен | BCHUSDT |
| BNB | Уже был | BNBUSDT |
| BTC | Уже был | BTCUSDT |
| BTG | Не добавлен | Нет активной пары USDT в Binance |
| BUSD | Не добавлен | Нет активной пары USDT в Binance |
| CRO | Не добавлен | Нет активной пары USDT в Binance |
| DAI | Не добавлен | Нет активной пары USDT в Binance |
| DASH | Добавлен | DASHUSDT |
| DOGE | Добавлен | DOGEUSDT |
| ETC | Добавлен | ETCUSDT |
| ETH | Уже был | ETHUSDT |
| FIL | Добавлен | FILUSDT |
| GUSD | Не добавлен | Нет активной пары USDT в Binance |
| HBAR | Добавлен | HBARUSDT |
| INJ | Добавлен | INJUSDT |
| KAS | Не добавлен | Нет активной пары USDT в Binance |
| LEO | Не добавлен | Нет активной пары USDT в Binance |
| LINK | Добавлен | LINKUSDT |
| LTC | Добавлен | LTCUSDT |
| LUNA | Добавлен | LUNAUSDT |
| LUNC | Добавлен | LUNCUSDT |
| OKB | Не добавлен | Нет активной пары USDT в Binance |
| PEPE | Добавлен | PEPEUSDT |
| SHIB | Добавлен | SHIBUSDT |
| SOL | Уже был | SOLUSDT |
| TON | Добавлен | Kraken TONUSDT |
| TRX | Уже был | TRXUSDT |
| UNI | Добавлен | UNIUSDT |
| USDC | Уже был | USDCUSDT |
| USDT | Уже был | Базовая единица; Kraken USDT/USD |
| VET | Добавлен | VETUSDT |
| XAUT | Добавлен | XAUTUSDT |
| XLM | Добавлен | XLMUSDT |
| XMR | Добавлен | Kraken XMRUSDT |
| ZEC | Добавлен | ZECUSDT |
| ZIL | Добавлен | ZILUSDT |

## Источники

- [Kraken: TON/USDT, XMR/USDT и USDT/USD](https://api.kraken.com/0/public/Ticker?pair=TONUSDT,XMRUSDT,USDTUSD).

- [Текущий ответ Frankfurter USD](https://api.frankfurter.dev/v2/rates?base=usd) и [каталог](https://frankfurter.dev/currencies/). Доступность и даты всех 52 новых фиатных валют проверены прямым запросом.
- [Binance exchangeInfo](https://data-api.binance.vision/api/v3/exchangeInfo): проверены baseAsset, quoteAsset=USDT, status=TRADING, isSpotTradingAllowed.
- [ЕЦБ: переход Болгарии на евро](https://www.ecb.europa.eu/euro/changeover/bulgaria/html/index.en.html).
- [Injective: официальный значок INJ](https://injective.com/brand); остальные новые криптовалютные значки из установленного Web3 Icons.
