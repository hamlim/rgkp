import React, { useState } from 'react'

// Uncomment to test out ambiguous file discovery
// import './file-not-found'

export default function Counter() {
  let [count, setCount] = useState<number>(0)

  return (
    <button onClick={() => setCount((c: number): number => c + 1)}>
      Count {count}
    </button>
  )
}
