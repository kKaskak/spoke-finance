import { ethers } from 'ethers';
import { getPosition } from '../../../server/data';
import { cachedJson, type CacheCtx } from '../_cache';

export const onRequestGet = async (context: CacheCtx & { params: { address: string } }) => {
    const { address } = context.params;
    if (!ethers.isAddress(address)) {
        return Response.json({ error: 'invalid address' }, { status: 400 });
    }
    return cachedJson(context, 10, () => getPosition(ethers.getAddress(address)));
};
