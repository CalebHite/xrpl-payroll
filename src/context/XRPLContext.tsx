import React, { createContext, useContext, ReactNode } from "react";
import { useXRPL } from "../hooks/useXRPL";

interface XRPLContextProps {
  isConnected: boolean;
  walletAddress: string | null;
  balance: string | { xrp: string } | null;
  connect: () => Promise<boolean>;
  addWallet: (name?: string, secret?: string) => Promise<{ address: string; name?: string; seed?: string } | null>;
  switchWallet: (address: string) => void;
  getWallets: () => { address: string; name?: string; seed?: string }[];
  removeWallet: (address: string) => void;
  getSecretKey: (address: string) => string | null;
  sendPayment: (destination: string, amount: string) => Promise<{ success: boolean; error?: string; txid?: string }>;
}

const XRPLContext = createContext<XRPLContextProps | undefined>(undefined);

export const XRPLProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const xrpl = useXRPL();

  return <XRPLContext.Provider value={xrpl}>{children}</XRPLContext.Provider>;
};

export const useXRPLContext = () => {
  const context = useContext(XRPLContext);
  if (!context) {
    throw new Error("useXRPLContext must be used within an XRPLProvider");
  }
  return context;
}; 