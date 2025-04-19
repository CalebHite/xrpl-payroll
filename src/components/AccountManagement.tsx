import React, { useState, useEffect } from 'react';
import { useXRPLContext } from '../context/XRPLContext';
import { RefreshCcw, X } from "lucide-react";

interface Wallet {
  address: string;
  name?: string;
  seed?: string;
}

export default function AccountManagement() {
  const {
    isConnected,
    walletAddress,
    balance,
    connect,
    addWallet,
    switchWallet,
    getWallets,
    removeWallet,
  } = useXRPLContext();

  const [secretKey, setSecretKey] = useState('');
  const [walletName, setWalletName] = useState('Company Account');
  const [wallets, setWallets] = useState<Wallet[]>([]);

  // Fetch wallets on mount and when wallet operations occur
  const refreshWallets = () => {
    const walletList = getWallets();
    setWallets(walletList);
  };

  useEffect(() => {
    refreshWallets();
  }, []);

  const handleAddWallet = async () => {
    if (!secretKey.trim()) return;
    
    await addWallet(walletName, secretKey);
    setSecretKey('');
    refreshWallets();
  };

  const handleRemoveWallet = async (address: string) => {
    removeWallet(address);
    refreshWallets();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Account Management</h2>
      
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Add New Wallet</h3>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            placeholder="Wallet Name"
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="text"
            placeholder="Secret Key"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            className="border p-2 rounded flex-grow"
            required
          />
          <button 
            onClick={handleAddWallet} 
            className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 px-6 cursor-pointer rounded-lg"
          >
            Add Wallet
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center mb-2">
          <h3 className="text-lg font-semibold">Your Wallets</h3>
          <RefreshCcw onClick={refreshWallets} className="cursor-pointer ml-2"/>
        </div>
        {wallets.length === 0 ? (
          <p className="text-gray-500">No wallets added yet.</p>
        ) : (
          <ul className="space-y-2">
            {wallets.map((wallet) => (
              <li 
                key={wallet.address} 
                className="p-3 border rounded flex flex-col md:flex-row md:items-center justify-between"
              >
                <div>
                  <p className="font-medium mb-2">{wallet.name || 'Unnamed Wallet'}</p>
                  <p className="text-sm text-gray-500 truncate mb-2">{wallet.address}</p>
                  {walletAddress === wallet.address && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-2 md:mt-0 space-x-2">
                  {walletAddress !== wallet.address && (
                    <button 
                      onClick={() => switchWallet(wallet.address)} 
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Switch
                    </button>
                  )}
                  <button 
                    onClick={() => handleRemoveWallet(wallet.address)} 
                    className="text-black text-sm px-4 py-2 rounded-lg cursor-pointer"
                  >
                    <X />  
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}