import type { ReactNode } from 'react'

export type PageTransitionDirection = 'forward' | 'back' | null

interface PageTransitionProps {
  pageId: string
  direction: PageTransitionDirection
  onAnimationEnd: () => void
  children: ReactNode
}

export function PageTransition({
  pageId,
  direction,
  onAnimationEnd,
  children,
}: PageTransitionProps) {
  const directionClass =
    direction === 'forward' ? 'page-slide-forward' : direction === 'back' ? 'page-slide-back' : ''

  return (
    <div className="page-viewport">
      <div
        key={pageId}
        className={`page-slide ${directionClass}`}
        onAnimationEnd={onAnimationEnd}
      >
        {children}
      </div>
    </div>
  )
}
