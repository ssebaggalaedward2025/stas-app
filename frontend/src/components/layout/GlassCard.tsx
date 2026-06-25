import React from 'react'

export default function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`glass-card transition-all duration-200 hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  )
}

