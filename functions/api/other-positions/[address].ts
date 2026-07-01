import { ethers } from 'ethers';
import { getOtherPositions } from '../../../server/platforms';

export const onRequestGet = async (context: { params: { address: string } }) => {
    const { address } = context.params;
    if (!ethers.isAddress(address)) {
        return Response.json({ error: 'invalid address' }, { status: 400 });
    }
    return Response.json(await getOtherPositions(ethers.getAddress(address)));
};
