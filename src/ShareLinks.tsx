import { Mail } from "lucide-react";
import { tr } from "./i18n";

const projectUrl = "https://github.com/noumenonnn/numera-widget";
const url = encodeURIComponent(projectUrl);
const text = encodeURIComponent(
  "Numera — currency and cryptocurrency converter",
);
const networks = [
  {
    name: "X.com",
    href: `https://x.com/intent/post?url=${url}&text=${text}`,
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933ZM17.61 20.644h2.039L6.486 3.24H4.298L17.61 20.644Z",
  },
  {
    name: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    path: "M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.931-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z",
  },
  {
    name: "Telegram",
    href: `https://t.me/share/url?url=${url}&text=${text}`,
    path: "M23.91 3.79 20.3 20.84c-.27 1.2-.98 1.49-1.98.93l-5.5-4.05-2.65 2.55c-.3.3-.55.55-1.13.55l.4-5.61L19.66 5.9c.45-.4-.1-.62-.7-.22L6.33 13.64.89 11.94c-1.18-.37-1.2-1.18.25-1.75L22.4 1.99c.98-.36 1.84.22 1.51 1.8Z",
  },
  {
    name: "LinkedIn",
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z",
  },
  {
    name: "VK",
    href: `https://vk.com/share.php?url=${url}&title=${text}`,
    path: "M13.07 18.93C4.87 18.93.19 13.31 0 3.95h4.11c.13 6.87 3.16 9.78 5.56 10.38V3.95h3.87v5.93c2.37-.26 4.86-2.96 5.7-5.93h3.86c-.64 3.66-3.34 6.36-5.26 7.47 1.92.9 4.99 3.26 6.16 7.51h-4.25c-.92-2.84-3.21-5.04-6.21-5.34v5.34h-.47Z",
  },
  {
    name: "Email",
    href: `mailto:?subject=${text}&body=${encodeURIComponent(`${decodeURIComponent(text)}\n${projectUrl}`)}`,
    path: null,
  },
];

export function ShareLinks({ locale }: { locale: "ru" | "en" }) {
  const t = tr[locale];
  return (
    <section className="share" aria-labelledby="share-heading">
      <h2 id="share-heading">{t.share}</h2>
      <div className="share-links">
        {networks.map(({ name, href, path }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t.share}: ${name}`}
            title={name}
          >
            {path ? (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={path} />
              </svg>
            ) : (
              <Mail size={20} aria-hidden="true" />
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
