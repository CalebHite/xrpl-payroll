"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useXRPL } from "../hooks/useXRPL"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { PinataService } from "../lib/pinata"

type Wallet = {
  address: string
  name?: string
  seed?: string
}

export default function SendPayment() {
  const { sendPaymentWithTrustlineHandling } = useXRPL()
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setShowQR(false)
    setQrData(null)
    setIsLoading(true)

    try {
      if (!selectedEmployee || !amount) {
        throw new Error("Please select an employee and fill in the amount")
      }

      // Basic XRPL address validation
      if (!selectedEmployee.startsWith("r") || selectedEmployee.length !== 34) {
        throw new Error("Invalid XRPL address format. XRPL addresses start with 'r' and are 34 characters long.")
      }

      const result = await sendPaymentWithTrustlineHandling(selectedEmployee, amount, {
        autoSetupTrustlineForSender: true,
        generateQRForRecipient: true,
      })

      if (result.success) {
        setSuccess(true)
        setSelectedEmployee("")
        setAmount("")
      } else {
        if (result.qrData) {
          setQrData(result.qrData)
          setShowQR(true)
        }
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

        {showQR && qrData && (
          <div className="mt-4 p-4 border rounded-lg bg-card">
            <h3 className="text-sm font-medium mb-2">Employee Payment QR Code</h3>
            <div className="flex justify-center bg-white p-4 rounded-lg">
              <QRCodeSVG value={qrData} size={200} />
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-48 bg-emerald-400 hover:bg-emerald-500 rounded-lg cursor-pointer"
          style={{ padding: "1rem" }}
        >
          {isLoading ? "Processing Payment..." : "Process Payment"}
        </Button>
      </form>
    </div>
  )
}
