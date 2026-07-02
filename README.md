# Spoke Finance

<img width="1570" height="1056" alt="Screenshot 2026-07-02 at 21 33 22" src="https://github.com/user-attachments/assets/16e996d7-c6a5-4bf0-a5bb-ff34e13fe7cb" />

Connect a wallet to manage your Aave v4 Bluechip Spoke position (`0x973a023A77420ba610f06b3858aD991Df6d85A08`), Aave v3, Morpho, and Fluid positions on Ethereum mainnet — all in one portfolio. Live health-factor projection, allocation charts, and per-asset market data.

<img width="1563" height="1055" alt="Screenshot 2026-07-02 at 21 33 31" src="https://github.com/user-attachments/assets/e9963632-7dd9-4b0c-b237-07c746902273" />

## Stack

- **Frontend**: React + Vite + TypeScript, SCSS modules, recharts, react-router, ethers v6.
- **API**: Express (`server/`), hosted on Fly.io in production — proxies on-chain reads (Alchemy RPC) so keys stay server-side and the heavy aggregation runs once.
- **Reads** go through the API; **writes** (supply/borrow/repay/withdraw/approve) are signed by the connected wallet.

## Setup

```bash
pnpm install
cp .env.sample .env   # fill ETH_SCAN_API_KEY and ALCHEMY_RPC_URL
pnpm dev              # api on :8787, web on :5173 (proxies /api)
```

Open http://localhost:5173 and connect a wallet on Ethereum mainnet.

## Scripts

- `pnpm dev` — run API + web together
- `pnpm build` — typecheck + production build
- `pnpm typecheck` — typecheck app and server
- `pnpm lint` — eslint
- `pnpm test` — projection + multicall self-checks

## How it works

- `server/data.ts` reads the Spoke + Oracle + Hub per reserve and aggregates `GET /api/reserves` and `GET /api/position/:address`. Reads are batched through Multicall3 (`server/multicall.ts`), cached, and retried on RPC rate limits.
- `src/lib/projection.ts` simulates an action client-side so the UI shows the resulting health factor before you sign (`HF = borrowPower / debt`).
- `src/lib/contracts.ts` runs each action approval-aware: it checks the ERC-20 allowance to the Spoke and sends the `approve` tx automatically before `supply`/`repay`.

## Deploy

Publishing a GitHub release deploys the web app to Cloudflare Pages ([spoke.finance](https://spoke.finance)) and the API to Fly.io via `.github/workflows/deploy.yml`.

## Value scales (Aave v4 Spoke)

`getUserAccountData` returns `healthFactor`/`avgCollateralFactor` scaled by `1e18`, `totalCollateralValue` by `1e26`, and `totalDebtValueRay` by `1e53`. Oracle prices are `1e8`; borrow rate (`hub.getAssetDrawnRate`) is `1e27`.
