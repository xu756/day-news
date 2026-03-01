import type { ReactNode } from 'react'

export function MdxCallout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <aside className="not-prose my-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
        {title}
      </p>
      <div className="text-sm leading-7 text-slate-700">{children}</div>
    </aside>
  )
}
