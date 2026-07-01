import { ethers } from 'ethers';
import { getOtherPositions } from '../../../server/platforms';
import { cachedJson, type CacheCtx } from '../_cache';

export const onRequestGet = async (context: CacheCtx & { params: { address: string } }) => {
    const { address } = context.params;
    if (!ethers.isAddress(address)) {
        return Response.json({ error: 'invalid address' }, { status: 400 });
    }
    return cachedJson(context, 10, () => getOtherPositions(ethers.getAddress(address)));
};
