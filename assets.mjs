import {mkdir,copyFile,writeFile} from 'node:fs/promises';
await mkdir('public/assets',{recursive:true});
for(const code of ['BTC','ETH','USDT','USDC','BNB','SOL','XRP','TRX']){const x=await import(`./node_modules/@web3icons/core/dist/svgs/tokens/background/${code}.svg.js`);await writeFile(`public/assets/${code}.svg`,x.default)}
for(const code of ['ru','us','eu','cn','gb','ae','tr','kz','ca','au','jp','ch','in','br','ua','by','ge','pl'])await copyFile(`node_modules/flag-icons/flags/4x3/${code}.svg`,`public/assets/${code}.svg`);
