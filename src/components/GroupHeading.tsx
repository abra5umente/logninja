import React from 'react'

// the house theme section heading: lowercase name, fading rule, optional controls on the right
export default function GroupHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="group-h">
      <b>{title}</b>
      <span className="rule" />
      {children}
    </div>
  )
}
