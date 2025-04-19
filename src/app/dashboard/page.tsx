"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WalletConnect from "@/components/WalletConnect"
import SendPayment from "@/components/SendPayment"
import { Wallet, SendHorizontal, Users } from "lucide-react"
import { XRPLProvider } from "../../context/XRPLContext"
import AccountManagement from '@/components/AccountManagement'

export default function DashboardPage() {
  return (
    <XRPLProvider>
      <div className="container mx-auto py-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-4xl font-bold mb-2 pt-16">Dashboard</h1>
        </div>

        <Tabs defaultValue="accounts" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="accounts" className="flex items-center gap-2 cursor-pointer">
            <Users className="h-4 w-4" />
              <span>Employees</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2 cursor-pointer">
              <SendHorizontal className="h-4 w-4" />
              <span>Payments</span>
            </TabsTrigger>
            <TabsTrigger value="account-management" className="flex items-center gap-2 cursor-pointer">
              <Wallet className="h-4 w-4" />
              <span>Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="p-6 border rounded-lg">
            <WalletConnect />
          </TabsContent>

          <TabsContent value="payments" className="p-6 border rounded-lg">
            <SendPayment />
          </TabsContent>

          <TabsContent value="account-management" className="p-6 border rounded-lg">
            <AccountManagement />
          </TabsContent>
        </Tabs>
      </div>
    </XRPLProvider>
  )
}
