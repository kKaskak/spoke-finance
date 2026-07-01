export type CacheCtx = { request: Request; waitUntil: (promise: Promise<unknown>) => void };

// edge-cache JSON per URL so bursts of visitors hit Alchemy at most once per TTL per colo
export const cachedJson = async (ctx: CacheCtx, ttlSeconds: number, load: () => Promise<unknown>): Promise<Response> => {
    const cache = (caches as unknown as { default: Cache }).default;
    const hit = await cache.match(ctx.request.url);
    if (hit) return hit;
    const res = Response.json(await load());
    res.headers.set('Cache-Control', `public, s-maxage=${ttlSeconds}`);
    ctx.waitUntil(cache.put(ctx.request.url, res.clone()));
    return res;
};
