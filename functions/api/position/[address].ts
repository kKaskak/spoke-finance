import { ethers } from 'ethers';
import { getPosition } from '../../../server/data';

export const onRequestGet = async (context: { params: { address: string } }) => {
    const { address } = context.params;
    if (!ethers.isAddress(address)) {
        return Response.json({ error: 'invalid address' }, { status: 400 });
    }
    return Response.json(await getPosition(ethers.getAddress(address)));
};
