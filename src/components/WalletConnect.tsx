"use client"

import { useState, useEffect } from "react"
import { useXRPL } from "../hooks/useXRPL"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Import, Copy, Trash2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { PinataService } from "../lib/pinata"

interface PinataResponse {
  id: string;
  ipfs_pin_hash: string;
  size: number;
  user_id: string;
  date_pinned: string;
  metadata: {
    name: string;
    keyvalues: {
      address: string;
      createdAt: string;
      lastUsed: string;
    };
  };
}

interface Wallet {
  name: string;
  address: string;
  createdAt: string;
  lastUsed: string;
}

export default function WalletConnect() {
  const {
    isConnected,
    walletAddress,
    balance,
    connect,
    addWallet,
    removeWallet,
  } = useXRPL()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [newAccountName, setNewAccountName] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [showSecretKeyInput, setShowSecretKeyInput] = useState(false)
  const { toast } = useToast()
  const pinataService = PinataService.getInstance()
  const [wallets, setWallets] = useState<Wallet[]>([])

  useEffect(() => {
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
        const pinataAccounts = await pinataService.getAllAccounts();
        console.log("Fetched accounts:", pinataAccounts);
        
        // Transform the Pinata response to match our Wallet interface
        const transformedWallets: Wallet[] = pinataAccounts.map((account: PinataResponse) => {
          // Make sure we access the right properties based on the console output
          return {
            name: account.metadata?.name || "Unknown Employee",
            address: account.metadata?.keyvalues?.address || "Unknown Address",
            createdAt: account.metadata?.keyvalues?.createdAt || account.date_pinned,
            lastUsed: account.metadata?.keyvalues?.lastUsed || account.date_pinned
          };
        });
        
        console.log("Transformed wallets:", transformedWallets);
        setWallets(transformedWallets);
      } catch (error) {
        console.error('Error fetching accounts from Pinata:', error);
      }
    }

    fetchAccounts()
  }, [])

  const handleImportClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowSecretKeyInput((prev) => !prev)
    setError(null)
    setStatus(null)
  }

  const handleConnectWithSecretKey = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      setError(null)
      setStatus("Adding employee account...")

      if (!secretKey) {
        throw new Error("Please enter a secret key")
      }

      if (!isConnected) {
        await connect()
      }

      await addWallet(newAccountName || undefined, secretKey)
      
      if (walletAddress) {
        const employeeMetadata = {
          name: newAccountName,
          address: walletAddress,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        }
        await pinataService.saveAccountMetadata(walletAddress, employeeMetadata)
        
        // Refresh the wallets list
        const pinataAccounts = await pinataService.getAllAccounts();
        const transformedWallets: Wallet[] = pinataAccounts.map((account: PinataResponse) => {
          return {
            name: account.metadata?.name || "Unknown Employee",
            address: account.metadata?.keyvalues?.address || "Unknown Address",
            createdAt: account.metadata?.keyvalues?.createdAt || account.date_pinned,
            lastUsed: account.metadata?.keyvalues?.lastUsed || account.date_pinned
          };
        });
        setWallets(transformedWallets);
      }

      setSecretKey("")
      setNewAccountName("")
      setShowSecretKeyInput(false)
      setStatus(null)
      
      toast({
        title: "Success",
        description: "Employee account added successfully",
      })
    } catch (error) {
      console.error("Error connecting with secret key:", error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("Failed to add employee account")
      }
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

      removeWallet(address)
      await pinataService.removeAccount(address);
      
      // Refresh the wallets list
      const pinataAccounts = await pinataService.getAllAccounts();
      const transformedWallets: Wallet[] = pinataAccounts.map((account: PinataResponse) => {
        return {
          name: account.metadata?.name || "Unknown Employee",
          address: account.metadata?.keyvalues?.address || "Unknown Address",
          createdAt: account.metadata?.keyvalues?.createdAt || account.date_pinned,
          lastUsed: account.metadata?.keyvalues?.lastUsed || account.date_pinned
        };
      });
      setWallets(transformedWallets);
      
      setStatus(null)
      
      toast({
        title: "Success",
        description: "Employee account removed successfully",
      })
    } catch (error) {
      console.error("Error removing account:", error)
      setError(error instanceof Error ? error.message : "Failed to remove account")
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

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Invalid Date";
    }
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
      ) : (
        <div className="space-y-6">
          {walletAddress && (
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
                        onClick={() => handleCopyAddress(walletAddress)}
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
          )}

          <div>
            <h3 className="text-lg font-medium mb-3">Employee Accounts ({wallets.length})</h3>
            {wallets.length === 0 ? (
              <p className="text-muted-foreground">No employee accounts found.</p>
            ) : (
              <div className="space-y-2">
                {wallets.map((wallet: Wallet, index: number) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="overflow-hidden">
                          <div className="font-medium">{wallet.name || "Unknown Employee"}</div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {wallet.address || "Unknown Address"}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyAddress(wallet.address)}
                              className="h-8 w-8 p-0"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {formatDate(wallet.createdAt)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last used: {formatDate(wallet.lastUsed)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAccount(wallet.address)}
                            className="text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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