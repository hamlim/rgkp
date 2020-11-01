import { useState } from 'react'
import { render } from 'react-dom'

function Comp() {
  let [c, setC] = useState(0)

  return <button onClick={() => setC((c) => c + 1)}>Count {c}</button>
}

render(<Comp />, document.querySelector('#root'))
