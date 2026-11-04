# Numera privacy policy

Effective date: 4 November 2026. Applies to Numera 1.0.8.

Numera performs currency calculations locally. Entered amounts, row order, chosen currencies, and preferences are stored in `browser.storage.local` in the Firefox profile. The extension has no developer backend, accounts, analytics, advertising, crash reporting, or telemetry.

While the popup is open, Numera can request public fiat exchange rates from `api.frankfurter.dev`, cryptocurrency market information from `data-api.binance.vision`, and the USDT/USD market rate from `api.kraken.com`. Requests include public market symbols and API parameters; entered amounts are not included. Providers receive standard network metadata such as the IP address and request time and handle it under their own policies. Numera sends no cookies or referrer with these requests. Scheduled refreshes stop when the last popup closes.

Numera does not read web pages, browsing history, bookmarks, or personal financial accounts. Images, fonts, and executable code are bundled locally. The manifest declares no collection of personal data or telemetry. This declaration does not mean the extension makes no network requests.

Stored data includes settings, last valid amounts, quote caches, retry information, and a bounded action receipt history used for reliable saving. Clear data by removing the extension through Firefox. Private windows are not supported because state is persistent and shared by the extension.

Questions: open a non-sensitive issue at https://github.com/noumenonnn/numera-widget/issues. Do not post private amounts or other personal information.

## На русском

Numera рассчитывает суммы локально и сохраняет настройки, валюты, введённые значения и кэш в профиле Firefox. Регистрации, аналитики и сервера разработчика нет. При открытом окне расширение запрашивает публичные курсы Frankfurter, Binance и Kraken. Введённые суммы не отправляются; поставщики получают обычные сетевые метаданные, включая IP-адрес и время запроса. Cookies и referrer не передаются. После закрытия последнего окна регулярное обновление прекращается.

Расширение не читает содержимое сайтов, историю, закладки и финансовые аккаунты. Ресурсы интерфейса находятся внутри расширения. Удаление расширения средствами Firefox удаляет его локальные данные. Приватные окна не поддерживаются. Вопросы можно задать через Issues репозитория, не публикуя личную информацию.
