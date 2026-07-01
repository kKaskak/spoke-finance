import { ethers } from 'ethers';
import {
    AAVE_V3_DATA_PROVIDER_ADDRESS,
    AAVE_V3_ORACLE_ADDRESS,
    AAVE_V3_POOL_ADDRESS,
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

const rpc = process.env.ALCHEMY_RPC_URL;
if (!rpc) throw new Error('ALCHEMY_RPC_URL missing in .env');

export const provider = new ethers.JsonRpcProvider(rpc);
export const spoke = new ethers.Contract(SPOKE_ADDRESS, SPOKE_READ_ABI, provider);
export const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, provider);

export const hubContract = (address: string) => new ethers.Contract(address, HUB_ABI, provider);
export const erc20 = (address: string) => new ethers.Contract(address, ERC20_ABI, provider);

export const aaveV3Pool = new ethers.Contract(AAVE_V3_POOL_ADDRESS, AAVE_V3_POOL_ABI, provider);
export const aaveV3DataProvider = new ethers.Contract(AAVE_V3_DATA_PROVIDER_ADDRESS, AAVE_V3_DATA_PROVIDER_ABI, provider);
export const aaveV3Oracle = new ethers.Contract(AAVE_V3_ORACLE_ADDRESS, AAVE_V3_ORACLE_ABI, provider);

export const fluidVaultResolver = new ethers.Contract(FLUID_VAULT_RESOLVER_ADDRESS, FLUID_VAULT_RESOLVER_ABI, provider);
