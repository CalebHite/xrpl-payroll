"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useXRPLContext } from "../context/XRPLContext"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { PinataService } from "../lib/pinata"

type Wallet = {
  address: string
  name?: string
  seed?: string
}

type PinataResponse = {
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
      type: string;
    };
  };
};

export default function SendPayment() {
  const { sendPayment, connect, isConnected, walletAddress } = useXRPLContext()
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrData, setQrData] = useState<string | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState("")

  const pinataService = PinataService.getInstance()

  useEffect(() => {
    const ensureConnection = async () => {
      if (!isConnected) {
        try {
          await connect();
        } catch (error) {
          setError("Failed to connect to XRP Ledger");
          console.error("Connection error:", error);
        }
      }
    };
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
    ensureConnection();
  }, [connect, isConnected])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setShowQR(false)
    setQrData(null)
    setIsLoading(true)

    if (!isConnected) {
      try {
        await connect();
      } catch (err) {
        throw new Error("Could not connect to XRP Ledger");
      }
    }

    if (!walletAddress) {
      throw new Error("No wallet selected. Please select or create a wallet first.");
    }

    try {
      if (!selectedEmployee || !amount) {
        throw new Error("Please select an employee and fill in the amount")
      }

      // Basic XRPL address validation
      if (!selectedEmployee.startsWith("r") || selectedEmployee.length !== 34) {
        throw new Error("Invalid XRPL address format. XRPL addresses start with 'r' and are 34 characters long.")
      }

      const result = await sendPayment(selectedEmployee, amount)

      if (result.success) {
        setSuccess(true)
        setSelectedEmployee("")
        setAmount("")
      } else {
        // Improve error message for account not found
        if (result.error?.includes("Account not found")) {
          throw new Error(
            "The destination account doesn't exist on the XRPL network. Please verify the address is correct and that the account has been activated.",
          )
        }
        throw new Error(result.error)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="employee">Select Employee</Label>
          <select
            id="employee"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full p-2 border rounded-lg text-sm text-neutral-500"
          >
            <option value="">Select an employee</option>
            {wallets.map((wallet) => (
              <option key={wallet.address} value={wallet.address}>
                {wallet.name} - {wallet.address}
              </option>
            ))}
          </select>
          {wallets.length === 0 && <p>No employees found.</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Payment Amount (RLUSD)</Label>
          <Input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter payment amount"
            step="0.000001"
            min="0.000001"
          />
        </div>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-2">Payment Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment amount:</span>
                <span>{amount || "0"} RLUSD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction fee:</span>
                <span>0.00001 RLUSD</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total payment:</span>
                <span>{amount ? (Number(amount) + 0.00001).toFixed(6) : "0"} RLUSD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Payment processed successfully!</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-48 bg-emerald-500 hover:bg-emerald-600 rounded-lg cursor-pointer"
          style={{ padding: "1rem" }}
        >
          {isLoading ? "Processing Payment..." : "Process Payment"}
        </Button>
      </form>
    </div>
  )
}
