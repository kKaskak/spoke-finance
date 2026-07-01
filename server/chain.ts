import { ethers } from 'ethers';
import { ORACLE_ADDRESS, SPOKE_ADDRESS } from '../shared/constants';
import { ERC20_ABI, HUB_ABI, ORACLE_ABI, SPOKE_READ_ABI } from './abi';

// ponytail: Node-only; no-op on Workers, where nodejs_compat populates process.env
try { process.loadEnvFile?.(); } catch { /* no .env file (Cloudflare/CI) */ }

const rpc = process.env.ALCHEMY_RPC_URL;
if (!rpc) throw new Error('ALCHEMY_RPC_URL missing in .env');

export const provider = new ethers.JsonRpcProvider(rpc);
export const spoke = new ethers.Contract(SPOKE_ADDRESS, SPOKE_READ_ABI, provider);
export const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, provider);

export const hubContract = (address: string) => new ethers.Contract(address, HUB_ABI, provider);
export const erc20 = (address: string) => new ethers.Contract(address, ERC20_ABI, provider);
