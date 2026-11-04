import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { catalog } from "./src/catalog.ts";
await mkdir("public/assets", { recursive: true });
for (const currency of catalog) {
  const destination = `public/${currency.icon}`;
  if (currency.kind === "fiat") {
    const filename = currency.icon.split("/").at(-1);
    await copyFile(
      `node_modules/flag-icons/flags/4x3/${filename}`,
      destination,
    );
  } else if (currency.code === "INJ") {
    // Official brand symbols retained for offline builds.
    await copyFile(`assets/source/${currency.code}.svg`, destination);
  } else if (currency.code === "TON") {
    const asset =
      await import("./node_modules/@web3icons/core/dist/svgs/networks/background/ton.svg.js");
    await writeFile(destination, asset.default);
  } else {
    const asset = await import(
      `./node_modules/@web3icons/core/dist/svgs/tokens/background/${currency.code}.svg.js`
    );
    await writeFile(destination, asset.default);
  }
}
