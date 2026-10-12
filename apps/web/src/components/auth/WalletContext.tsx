'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'public' | 'issuer' | 'holder' | 'verifier' | 'admin';

export interface DemoAccount {
  name: string;
  role: UserRole;
  address: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Northfield Registrar (Issuer)',
    role: 'issuer',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
  {
    name: 'Alex Vance (Graduate Holder)',
    role: 'holder',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  },
  {
    name: 'State Licensing Board (Verifier)',
    role: 'verifier',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
  {
    name: 'Registry Administrator',
    role: 'admin',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
];

export interface NetworkConfig {
  chainId: number;
  name: string;
  isTestnet: boolean;
  explorerUrl?: string;
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  31337: { chainId: 31337, name: 'Hardhat Local', isTestnet: true },
  80002: { chainId: 80002, name: 'Polygon Amoy', isTestnet: true, explorerUrl: 'https://amoy.polygonscan.com' },
  11155111: { chainId: 11155111, name: 'Ethereum Sepolia', isTestnet: true, explorerUrl: 'https://sepolia.etherscan.io' },
};

interface WalletContextValue {
  role: UserRole;
  setRole: (r: UserRole) => void;
  address: string | null;
  chainId: number;
  isConnected: boolean;
  isSiweAuthenticated: boolean;
  connectDemoAccount: (acc: DemoAccount) => void;
  disconnect: () => void;
  signInWithEthereum: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextValue>({
  role: 'public',
  setRole: () => {},
  address: null,
  chainId: 31337,
  isConnected: false,
  isSiweAuthenticated: false,
  connectDemoAccount: () => {},
  disconnect: () => {},
  signInWithEthereum: async () => false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('public');
  const [address, setAddress] = useState<string | null>(null);
  const [chainId] = useState<number>(31337);
  const [isSiweAuthenticated, setIsSiweAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('zkdg_role') as UserRole | null;
    const savedAddr = localStorage.getItem('zkdg_address');
    if (savedRole) setRoleState(savedRole);
    if (savedAddr) setAddress(savedAddr);
  }, []);

  const setRole = (r: UserRole) => {
    setRoleState(r);
    localStorage.setItem('zkdg_role', r);
  };

  const connectDemoAccount = (acc: DemoAccount) => {
    setAddress(acc.address);
    setRole(acc.role);
    setIsSiweAuthenticated(true);
    localStorage.setItem('zkdg_address', acc.address);
  };

  const disconnect = () => {
    setAddress(null);
    setRole('public');
    setIsSiweAuthenticated(false);
    localStorage.removeItem('zkdg_address');
    localStorage.removeItem('zkdg_role');
  };

  const signInWithEthereum = async () => {
    // Simulates or connects SIWE session
    if (!address) return false;
    setIsSiweAuthenticated(true);
    return true;
  };

  return (
    <WalletContext.Provider
      value={{
        role,
        setRole,
        address,
        chainId,
        isConnected: Boolean(address),
        isSiweAuthenticated,
        connectDemoAccount,
        disconnect,
        signInWithEthereum,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
