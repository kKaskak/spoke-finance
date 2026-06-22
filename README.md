# Aave v4 Portal — Bluechip Spoke

Connect a wallet, view your position, and manage it (supply, withdraw, borrow, repay, toggle collateral) against the Aave v4 Bluechip Spoke (`0x973a023A77420ba610f06b3858aD991Df6d85A08`) on Ethereum mainnet. Live health-factor projection, allocation charts, and per-asset market data.

## Stack

- **Frontend**: React + Vite + TypeScript, SCSS modules, recharts, react-router, ethers v6.
- **API**: Express — proxies on-chain reads (Alchemy RPC) so keys stay server-side and the heavy aggregation runs once.
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
- `pnpm test` — health-factor projection self-check

## How it works

- `server/data.ts` reads the Spoke + Oracle + Hub per reserve and aggregates `GET /api/reserves` and `GET /api/position/:address`. Responses are concurrency-limited and cached, with retry on RPC rate limits.
- `src/lib/projection.ts` simulates an action client-side so the UI shows the resulting health factor before you sign (`HF = borrowPower / debt`).
- `src/lib/contracts.ts` runs each action approval-aware: it checks the ERC-20 allowance to the Spoke and sends the `approve` tx automatically before `supply`/`repay`.

## Value scales (Aave v4 Spoke)

`getUserAccountData` returns `healthFactor`/`avgCollateralFactor` scaled by `1e18`, `totalCollateralValue` by `1e26`, and `totalDebtValueRay` by `1e53`. Oracle prices are `1e8`; borrow rate (`hub.getAssetDrawnRate`) is `1e27`.
