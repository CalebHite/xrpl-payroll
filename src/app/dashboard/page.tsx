"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WalletConnect from "@/components/WalletConnect"
import SendPayment from "@/components/SendPayment"
import { Wallet, SendHorizontal } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">Payroll</h1>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="accounts" className="flex items-center gap-2 cursor-pointer">
            <Wallet className="h-4 w-4" />
            <span>Employees</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2 cursor-pointer">
            <SendHorizontal className="h-4 w-4" />
            <span>Send Payment</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="p-6 border rounded-lg">
          <WalletConnect />
        </TabsContent>

        <TabsContent value="payments" className="p-6 border rounded-lg">
          <SendPayment />
        </TabsContent>
      </Tabs>
    </div>
  )
}
