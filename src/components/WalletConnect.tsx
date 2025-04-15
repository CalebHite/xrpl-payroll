"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useXRPL } from "../hooks/useXRPL"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Eye, EyeOff, Import, SwitchCamera, Trash2, Copy } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { PinataService } from "../lib/pinata"

interface Wallet {
  name: string;
  address: string;
  createdAt: string;
  lastUsed: string;
  tags?: string[];
  seed?: string;
}

export default function WalletConnect() {
  const {
    isConnected,
    walletAddress,
    balance,
    connect,
    addWallet,
    switchWallet,
    getWallets,
    removeWallet,
    getSecretKey,
  } = useXRPL()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [newAccountName, setNewAccountName] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [showSecretKeyInput, setShowSecretKeyInput] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState<string | null>(null)
  const { toast } = useToast()
  const pinataService = PinataService.getInstance()
  const [wallets, setWallets] = useState<Wallet[]>([])

  useEffect(() => {
    console.log("WalletConnect component mounted")
    const checkConnection = async () => {
      try {
        if (!isConnected) {
          await connect()
        }
        setIsLoading(false)
      } catch (error) {
        console.error("Error checking connection:", error)
        setIsLoading(false)
      }
    }

    checkConnection()
  }, [isConnected, connect])

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accounts = await pinataService.getAllAccounts();
        setWallets(accounts);
      } catch (error) {
        console.error('Error fetching accounts from Pinata:', error);
      }
    }

    fetchAccounts()
  }, [])

  const handleImportClick = (e: React.MouseEvent) => {
    e.preventDefault()
    console.log("Import account button clicked")
    setShowSecretKeyInput((prev) => !prev)
    setError(null)
    setStatus(null)
  }

  const handleConnectWithSecretKey = async (e: React.MouseEvent) => {
    e.preventDefault()
    console.log("Import button clicked")
    try {
      setIsLoading(true)
      setError(null)
      setStatus("Connecting with secret key...")

      if (!secretKey) {
        throw new Error("Please enter a secret key")
      }

      console.log("Attempting to connect with secret key:", secretKey)

      if (!isConnected) {
        console.log("Not connected, connecting first...")
        await connect()
      }

      console.log("Adding wallet with secret key...")
      await addWallet(newAccountName || undefined, secretKey)
      console.log("Wallet added successfully")
      
      if (walletAddress) {
        // Upload employee data to Pinata
        const employeeMetadata = {
          name: newAccountName,
          address: walletAddress,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        }
        await pinataService.saveAccountMetadata(walletAddress, employeeMetadata)
        console.log("Employee data uploaded to Pinata")
      } else {
        console.error("Failed to upload employee data: walletAddress is null")
      }

      setSecretKey("")
      setNewAccountName("")
      setShowSecretKeyInput(false)
      setStatus(null)
    } catch (error) {
      console.error("Error connecting with secret key:", error)
      if (error instanceof Error) {
        if (error.message === "This account is already imported") {
          setError("This account is already in your wallet list")
        } else if (error.message === "Invalid secret key") {
          setError("Invalid secret key. Please check and try again.")
        } else {
          setError(error.message)
        }
      } else {
        setError("Failed to connect with secret key")
      }
      setStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchAccount = async (address: string) => {
    try {
      setIsLoading(true)
      setError(null)
      setStatus("Switching account...")

      await switchWallet(address)
      setStatus(null)
    } catch (error) {
      console.error("Error switching account:", error)
      setError(error instanceof Error ? error.message : "Failed to switch account")
      setStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveAccount = async (address: string) => {
    try {
      setIsLoading(true)
      setError(null)
      setStatus("Removing account...")

      await removeWallet(address)
      setStatus(null)
    } catch (error) {
      console.error("Error removing account:", error)
      setError(error instanceof Error ? error.message : "Failed to remove account")
      setStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast({
      title: "Address copied",
      description: "Wallet address has been copied to clipboard",
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 text-[#008CFF] animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {showSecretKeyInput ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountName">Employee Name</Label>
            <Input
              id="accountName"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Enter employee name"
            />
          </div>  
          <div className="space-y-2">
            <Label htmlFor="secretKey">Employee Secret Key</Label>
            <Input
              type="password"
              id="secretKey"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Enter employee secret key"
            />
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleConnectWithSecretKey}
              disabled={isLoading}
              className="flex-1 bg-emerald-400 hover:bg-emerald-500 cursor-pointer"
            >
              {isLoading ? "Adding Employee..." : "Add Employee"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowSecretKeyInput(false)
                setSecretKey("")
                setNewAccountName("")
                setError(null)
                setStatus(null)
              }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
          </div>
          {status && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : wallets.length === 0 ? (
        <div className="space-y-4">
          <Button variant="outline" onClick={handleImportClick} className="w-full max-w-[300px] cursor-pointer">
            <Import className="mr-2 h-4 w-4 cursor-pointer" />
            Add Employee Account
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Company Account:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm truncate max-w-[200px]">{walletAddress}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyAddress(walletAddress || "")}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Company Balance:</span>
                  <span className="font-medium">
                    {!balance
                      ? "0 RLUSD"
                      : typeof balance === "object"
                        ? `${balance.xrp} RLUSD${balance.rlusd !== "0" ? `, ${balance.rlusd} RLUSD` : ""}`
                        : `${balance} RLUSD`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-medium mb-3">Employee Accounts</h3>
            <div className="space-y-2">
              {wallets.map((wallet: Wallet) => (
                <Card key={wallet.address}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="overflow-hidden">
                        <div className="font-medium">{wallet.name}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">{wallet.address}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyAddress(wallet.address)}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {wallets.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAccount(wallet.address)}
                            className="text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-medium mb-3">Add New Employee</h3>
            <Button variant="outline" onClick={handleImportClick} className="w-full max-w-[300px] cursor-pointer">
              <Import className="mr-2 h-4 w-4" />
              Add Employee Account
            </Button>
          </div>

          {status && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
