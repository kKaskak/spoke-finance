import { ethers } from 'ethers';
import {
    AAVE_V3_DATA_PROVIDER_ADDRESS,
    AAVE_V3_ORACLE_ADDRESS,
    AAVE_V3_POOL_ADDRESS,
    CHAIN_ID,
    FLUID_VAULT_RESOLVER_ADDRESS,
    ORACLE_ADDRESS,
    SPOKE_ADDRESS
} from '../shared/constants';
import {
    AAVE_V3_DATA_PROVIDER_ABI,
    AAVE_V3_ORACLE_ABI,
    AAVE_V3_POOL_ABI,
    ERC20_ABI,
    FLUID_VAULT_RESOLVER_ABI,
    HUB_ABI,
    ORACLE_ABI,
    SPOKE_READ_ABI
} from './abi';

// ponytail: Node-only; no-op on Workers, where nodejs_compat populates process.env
try { process.loadEnvFile?.(); } catch { /* no .env file (Cloudflare/CI) */ }

// Workers cancel a request's pending work when it ends, so a shared provider poisons later requests; build per request
export const getProvider = () => {
    const rpc = process.env.ALCHEMY_RPC_URL;
    if (!rpc) throw new Error('ALCHEMY_RPC_URL missing in .env');
    const req = new ethers.FetchRequest(rpc);
    req.timeout = 15_000;
    return new ethers.JsonRpcProvider(req, CHAIN_ID, { staticNetwork: true });
};

const lazyContract = (address: string, abi: ethers.InterfaceAbi) => {
    const iface = new ethers.Interface(abi);
    return () => new ethers.Contract(address, iface, getProvider());
};

export const getSpoke = lazyContract(SPOKE_ADDRESS, SPOKE_READ_ABI);
export const getOracle = lazyContract(ORACLE_ADDRESS, ORACLE_ABI);

export const hubIface = new ethers.Interface(HUB_ABI);
export const erc20Iface = new ethers.Interface(ERC20_ABI);
export const hubContract = (address: string) => new ethers.Contract(address, HUB_ABI, getProvider());
export const erc20 = (address: string) => new ethers.Contract(address, ERC20_ABI, getProvider());

export const getAaveV3Pool = lazyContract(AAVE_V3_POOL_ADDRESS, AAVE_V3_POOL_ABI);
export const getAaveV3DataProvider = lazyContract(AAVE_V3_DATA_PROVIDER_ADDRESS, AAVE_V3_DATA_PROVIDER_ABI);
export const getAaveV3Oracle = lazyContract(AAVE_V3_ORACLE_ADDRESS, AAVE_V3_ORACLE_ABI);

export const getFluidVaultResolver = lazyContract(FLUID_VAULT_RESOLVER_ADDRESS, FLUID_VAULT_RESOLVER_ABI);
