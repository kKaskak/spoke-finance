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

let provider: ethers.JsonRpcProvider | undefined;
// Workers forbid timers/IO in global scope, so the provider is built on first use inside a handler
export const getProvider = () => {
    if (!provider) {
        const rpc = process.env.ALCHEMY_RPC_URL;
        if (!rpc) throw new Error('ALCHEMY_RPC_URL missing in .env');
        provider = new ethers.JsonRpcProvider(rpc, CHAIN_ID, { staticNetwork: true });
    }
    return provider;
};

const lazyContract = (address: string, abi: ethers.InterfaceAbi) => {
    let c: ethers.Contract | undefined;
    return () => (c ??= new ethers.Contract(address, abi, getProvider()));
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
