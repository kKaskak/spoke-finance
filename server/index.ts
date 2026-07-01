import cors from 'cors';
import { ethers } from 'ethers';
import express from 'express';
import { getPosition, getReserves } from './data';
import { getOtherMarkets, getOtherPositions } from './platforms';

const app = express();
app.use(cors());

const wrap = (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    (req: express.Request, res: express.Response) => {
        fn(req, res).catch((err) => {
            console.error(req.path, err);
            res.status(500).json({ error: err.message ?? 'internal error' });
        });
    };

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/reserves', wrap(async (_req, res) => {
    res.json(await getReserves());
}));

app.get('/api/position/:address', wrap(async (req, res) => {
    const address = req.params.address;
    if (!ethers.isAddress(address)) {
        res.status(400).json({ error: 'invalid address' });
        return;
    }
    res.json(await getPosition(ethers.getAddress(address)));
}));

app.get('/api/other-markets', wrap(async (_req, res) => {
    res.json(await getOtherMarkets());
}));

app.get('/api/other-positions/:address', wrap(async (req, res) => {
    const address = req.params.address;
    if (!ethers.isAddress(address)) {
        res.status(400).json({ error: 'invalid address' });
        return;
    }
    res.json(await getOtherPositions(ethers.getAddress(address)));
}));

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.warn(`api listening on :${port}`));
