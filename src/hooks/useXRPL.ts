"use client"

import { useState, useEffect, useCallback } from "react"
import { Client, Wallet, xrpToDrops } from "xrpl"

export const useXRPL = () => {
  const [client, setClient] = useState<Client | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | { xrp: string } | null>(null)
  const [wallets, setWallets] = useState<{ address: string; name?: string; seed?: string }[]>([])

  const connect = useCallback(async () => {
    try {
      // Create a client and connect to XRPL Testnet
      const xrplClient = new Client("wss://s.altnet.rippletest.net:51233")
      await xrplClient.connect()
      setClient(xrplClient)
      setIsConnected(true)
      console.log("Connected to XRPL")
      
      // If there are wallets, set the first one as active
      if (wallets.length > 0) {
        setWalletAddress(wallets[0].address)
      }
      
      return true
    } catch (error) {
      console.error("Failed to connect to XRPL:", error)
      return false
    }
  }, [wallets])

  const getBalance = useCallback(async (address: string) => {
    if (!client || !address) return null
    
    try {
      const response = await client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated"
      })
      
      // Convert drops to XRP (1 XRP = 1,000,000 drops)
      const xrpBalance = (Number(response.result.account_data.Balance) / 1000000).toString()
      return { xrp: xrpBalance }
    } catch (error) {
      console.error("Failed to get balance:", error)
      return null
    }
  }, [client])

  useEffect(() => {
    if (client && walletAddress) {
      getBalance(walletAddress).then(setBalance)
    }
  }, [walletAddress, getBalance, client])

  const addWallet = useCallback(async (name?: string, secret?: string) => {
    if (!client) {
      console.error("Client not connected")
      return null
    }
    
    try {
      let wallet
      
      if (secret) {
        // Import existing wallet using seed
        wallet = Wallet.fromSeed(secret)
      } else {
        // Generate new wallet
        wallet = Wallet.generate()
      }
      
      const newWallet = {
        address: wallet.address,
        name: name || "New Account",
        seed: wallet.seed,
      }
      
      setWallets((prevWallets) => [...prevWallets, newWallet])
      setWalletAddress(newWallet.address)
      
      return newWallet
    } catch (error) {
      console.error("Failed to add wallet:", error)
      return null
    }
  }, [client])

  const switchWallet = useCallback((address: string) => {
    setWalletAddress(address)
  }, [])

  const getWallets = useCallback(() => {
    return wallets
  }, [wallets])

  const removeWallet = useCallback(
    (address: string) => {
      setWallets((prevWallets) => prevWallets.filter((wallet) => wallet.address !== address))
      if (walletAddress === address) {
        setWalletAddress(wallets.length > 1 ? wallets[0].address : null)
      }
    },
    [walletAddress, wallets],
  )

  const getSecretKey = useCallback(
    (address: string) => {
      const wallet = wallets.find((w) => w.address === address)
      return wallet?.seed || null
    },
    [wallets],
  )

  const sendPayment = useCallback(async (destination: string, amount: string) => {
    if (!client || !walletAddress) {
      return { success: false, error: "Client not connected or wallet not selected" }
    }
    
    const seed = getSecretKey(walletAddress)
    if (!seed) {
      return { success: false, error: "Wallet seed not found" }
    }
    
    try {
      // Create wallet instance from seed
      const wallet = Wallet.fromSeed(seed)
      
      // Prepare payment transaction
      const prepared = await client.autofill({
        TransactionType: "Payment",
        Account: walletAddress,
        Amount: xrpToDrops(amount), // Convert XRP to drops
        Destination: destination
      })
      
      // Sign the transaction
      const signed = wallet.sign(prepared)
      
      // Submit the transaction
      const result = await client.submitAndWait(signed.tx_blob)
      
      // Check transaction result
      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        // Update the balance after successful transaction
        const newBalance = await getBalance(walletAddress)
        setBalance(newBalance)
        return { success: true, txid: result.result.hash }
      } else {
        return { 
          success: false, 
          error: `Transaction failed: ${result.result.meta.TransactionResult}`
        }
      }
    } catch (error) {
      console.error("Payment error:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error during payment"
      }
    }
  }, [client, walletAddress, getSecretKey, getBalance])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client) {
        client.disconnect()
      }
    }
  }, [client])

  return {
    isConnected,
    walletAddress,
    balance,
    connect,
    addWallet,
    switchWallet,
    getWallets,
    removeWallet,
    getSecretKey,
    sendPayment,
  }
}