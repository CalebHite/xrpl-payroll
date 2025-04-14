import WalletConnect from '@/components/WalletConnect';
import SendPayment from '@/components/SendPayment';


export default function Home(){
  return (
    <main>
      <WalletConnect />
      <SendPayment />
    </main>
  )
}