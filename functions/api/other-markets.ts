import { getOtherMarkets } from '../../server/platforms';
import { cachedJson, type CacheCtx } from './_cache';

export const onRequestGet = async (ctx: CacheCtx) => cachedJson(ctx, 60, getOtherMarkets);
