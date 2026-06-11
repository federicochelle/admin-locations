import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import {
  buttonBaseClassName,
  buttonVariantClasses,
  type ButtonVariant,
} from './button.styles'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
  }
>

function Button({
  children,
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        buttonBaseClassName,
        buttonVariantClasses[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
