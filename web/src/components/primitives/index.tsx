import type { ReactNode } from 'react'

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'secondary'
}

export function Card({ children }: { children: ReactNode }) {
  return <div className='card'>{children}</div>
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className='chip'>{children}</span>
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className='pill'>{children}</span>
}

export function Button({ children, onClick, kind = 'primary' }: ButtonProps) {
  return (
    <button type='button' onClick={onClick} className={`btn btn-${kind}`}>
      {children}
    </button>
  )
}

export function IconButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type='button' onClick={onClick} className='icon-btn'>
      {children}
    </button>
  )
}

export function Modal({ children }: { children: ReactNode }) {
  return <div className='modal'>{children}</div>
}

export function Toast({ children }: { children: ReactNode }) {
  return <div className='toast'>{children}</div>
}

export function Skeleton() {
  return <div className='skeleton' />
}

export function EmptyState({ title }: { title: string }) {
  return <div className='empty-state'>{title}</div>
}

export function Dropdown({ children }: { children: ReactNode }) {
  return <div className='dropdown'>{children}</div>
}

export function Tabs({ children }: { children: ReactNode }) {
  return <div className='tabs'>{children}</div>
}
