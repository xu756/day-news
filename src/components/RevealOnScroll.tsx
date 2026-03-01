import type { HTMLAttributes, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

type RevealOnScrollProps = {
  children: ReactNode
  className?: string
  delayMs?: number
  once?: boolean
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>

export function RevealOnScroll(props: RevealOnScrollProps) {
  const {
    children,
    className = '',
    delayMs = 0,
    once = true,
    ...restProps
  } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true)
            if (once) observer.unobserve(entry.target)
          } else if (!once) {
            setIsVisible(false)
          }
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -3% 0px',
      },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [once])

  return (
    <div
      {...restProps}
      ref={ref}
      style={{
        ...(restProps.style ?? {}),
        transitionDelay: `${delayMs}ms`,
      }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${isVisible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-4 opacity-0 blur-[2px] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0'} ${className}`.trim()}
    >
      {children}
    </div>
  )
}
