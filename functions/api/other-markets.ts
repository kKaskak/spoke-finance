import { getOtherMarkets } from '../../server/platforms';

export const onRequestGet = async () => Response.json(await getOtherMarkets());
