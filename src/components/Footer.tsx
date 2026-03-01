import { useState } from 'react'

export default function Footer() {
  const year = new Date().getFullYear()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <footer className="mx-auto mt-12 w-full max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50/70 p-6 text-center shadow-sm sm:p-8">
        <h3 className="font-serif text-2xl font-bold text-slate-900">
          订阅AI资讯速览
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          英文一手信源，AI行业内参。
        </p>

        <form
          className="mx-auto mt-5 flex w-full max-w-lg flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
          }}
        >
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(event) => {
              setSubmitted(false)
              setEmail(event.target.value)
            }}
            aria-label="Email"
            required
            className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            订阅
          </button>
        </form>

        {submitted ? (
          <p className="mt-3 text-sm text-emerald-700">
            已记录，后续可接入订阅服务。
          </p>
        ) : null}
      </section>

      <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-slate-500">
        <a href="/digest" className="transition hover:text-slate-800">
          存档
        </a>
        <span>·</span>
        <span>公众号</span>
        <span>·</span>
        <a href="/digest" className="transition hover:text-slate-800">
          RSS
        </a>
        <span>·</span>
        <a href="/about" className="transition hover:text-slate-800">
          方法论
        </a>
        <span>·</span>
        <a href="/digest" className="transition hover:text-slate-800">
          更新日志
        </a>
      </nav>

      <p className="mt-2 text-center text-xs text-slate-500">
        © {year} AI资讯速览
      </p>
    </footer>
  )
}
