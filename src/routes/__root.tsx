import Footer from '#/components/Footer'
import Header from '#/components/Header'
import { Outlet, createRootRoute } from '@tanstack/react-router'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f5f5f4_38%,_#f5f5f4_100%)] text-slate-700 antialiased">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}
