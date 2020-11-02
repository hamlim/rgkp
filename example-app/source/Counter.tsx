import React, { useState } from 'react'

export default function Counter() {
  let [count, setCount] = useState<number>(0)

  return (
    <button onClick={() => setCount((c: number): number => c + 1)}>
      Count {count}
    </button>
  )
}
