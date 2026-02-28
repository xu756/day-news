export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[#d8e0db] px-4 py-8 text-[#708177]">
      <div className="mx-auto flex w-full max-w-[820px] items-center justify-between gap-4 text-xs">
        <p className="m-0">© {year} AI资讯速览</p>
        <p className="m-0">英文一手信源 · 每日 3 条</p>
      </div>
    </footer>
  )
}
