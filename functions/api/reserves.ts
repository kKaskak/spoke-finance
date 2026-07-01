import { getReserves } from '../../server/data';

export const onRequestGet = async () => Response.json(await getReserves());
