"use client"

import type React from "react"

import { useState } from "react"
import { useXRPL } from "../hooks/useXRPL"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

export default function SendPayment() {
  const { sendPaymentWithTrustlineHandling, walletAddress } = useXRPL()
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrData, setQrData] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setShowQR(false)
    setQrData(null)
    setIsLoading(true)

    try {
      if (!destination || !amount) {
        throw new Error("Please fill in all fields")
      }

      // Basic XRPL address validation
      if (!destination.startsWith('r') || destination.length !== 34) {
        throw new Error("Invalid XRPL address format. XRPL addresses start with 'r' and are 34 characters long.")
      }

      const result = await sendPaymentWithTrustlineHandling(destination, amount, {
        autoSetupTrustlineForSender: true,
        generateQRForRecipient: true
      })

      if (result.success) {
        setSuccess(true)
        setDestination("")
        setAmount("")
      } else {
        if (result.qrData) {
          setQrData(result.qrData)
          setShowQR(true)
        }
        // Improve error message for account not found
        if (result.error?.includes("Account not found")) {
          throw new Error("The destination account doesn't exist on the XRPL network. Please verify the address is correct and that the account has been activated.")
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
          <Label htmlFor="destination">Destination Address</Label>
          <Input
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter XRPL address"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (RLUSD)</Label>
          <Input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            step="0.000001"
            min="0.000001"
          />
        </div>

        <Card className="bg-slate-50 border-none">
          <CardContent className="pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Transaction Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount to send:</span>
                <span>{amount || "0"} RLUSD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Transaction fee:</span>
                <span>0.00001 RLUSD</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-gray-700">Total cost:</span>
                <span>{amount ? (Number(amount) + 0.00001).toFixed(6) : "0"} RLUSD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Payment sent successfully!</AlertDescription>
          </Alert>
        )}

        {showQR && qrData && (
          <div className="mt-4 p-4 border rounded-lg">
            <h3 className="text-sm font-medium mb-2">Scan QR Code to Complete Payment</h3>
            <div className="flex justify-center">
              <QRCodeSVG value={qrData} size={200} />
            </div>
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-48 bg-[#008CFF] hover:bg-[#0070CC] rounded-lg cursor-pointer" style={{ padding: "1rem" }}>
          {isLoading ? "Sending..." : "Send Payment"}
        </Button>
      </form>
    </div>
  )
}

