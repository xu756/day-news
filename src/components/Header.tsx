import { Link } from '@tanstack/react-router'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#d3ddd8] bg-[#f4f7f5]/95 px-4 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-[820px] items-center justify-between">
        <Link
          to="/digest"
          className="text-sm font-semibold tracking-[0.14em] text-[#3d5d50] uppercase no-underline"
        >
          AI资讯速览
        </Link>

        <Link
          to="/digest"
          className="text-sm text-[#4f665d] no-underline hover:underline"
          activeProps={{ className: 'text-sm text-[#20342f] no-underline underline' }}
        >
          存档
        </Link>
      </nav>
    </header>
  )
}
