import type { HTMLAttributes, PropsWithChildren } from 'react'

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>

function Card({ children, className = '', ...props }: CardProps) {
  return (
    <section
      className={[
        'rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </section>
  )
}

export default Card
