import { getReserves } from '../../server/data';
import { cachedJson, type CacheCtx } from './_cache';

export const onRequestGet = async (ctx: CacheCtx) => cachedJson(ctx, 15, getReserves);
