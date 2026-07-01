import type { OtherMarketsResponse, OtherPositionsResponse } from '../shared/types';
import * as aaveV3 from './aaveV3';
import * as fluid from './fluid';
import * as morpho from './morpho';

const settle = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
        return await p;
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const getOtherMarkets = async (): Promise<OtherMarketsResponse> => {
    const [aaveV3Data, morphoData, fluidData] = await Promise.all([
        settle(aaveV3.getReserves()),
        settle(morpho.getMarkets()),
        settle(fluid.getMarkets())
    ]);
    return { aaveV3: aaveV3Data, morpho: morphoData, fluid: fluidData };
};

export const getOtherPositions = async (address: string): Promise<OtherPositionsResponse> => {
    const [aaveV3Data, morphoData, fluidData] = await Promise.all([
        settle(aaveV3.getPosition(address)),
        settle(morpho.getSummary(address)),
        settle(fluid.getSummary(address))
    ]);
    return { aaveV3: aaveV3Data, morpho: morphoData, fluid: fluidData };
};
