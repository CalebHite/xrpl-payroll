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

  const wallets = getWallets()

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

  const handleAddAccount = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setStatus("Creating new account...")

      if (!isConnected) {
        await connect()
      }

      await addWallet(newAccountName || undefined)
      setNewAccountName("")
      setStatus(null)
    } catch (error) {
      console.error("Error adding account:", error)
      setError(error instanceof Error ? error.message : "Failed to add account")
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

  const handleShowSecretKey = (address: string) => {
    const key = getSecretKey(address)
    if (key) {
      setShowSecretKey(showSecretKey === key ? null : key)
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
              {wallets.map((wallet) => (
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
                        {showSecretKey === wallet.seed && (
                          <div className="mt-2 text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                            Employee Secret Key: {wallet.seed}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {wallet.address !== walletAddress && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSwitchAccount(wallet.address)}
                            className="text-[#2E7D32] h-8 w-8 p-0"
                          >
                            <SwitchCamera className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowSecretKey(wallet.address)}
                          className="h-8 w-8 p-0"
                        >
                          {showSecretKey === wallet.seed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
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
