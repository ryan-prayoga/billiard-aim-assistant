import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'

type Point = { x: number; y: number }
type Step = 'cue' | 'object' | 'pocket'

const steps: { key: Step; label: string }[] = [
  { key: 'cue', label: 'Cue ball' },
  { key: 'object', label: 'Object ball' },
  { key: 'pocket', label: 'Pocket' },
]

const BALL_RADIUS = 18

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function norm(from: Point, to: Point) {
  const d = dist(from, to) || 1
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d }
}

function App() {
  const [image, setImage] = useState<string>('')
  const [cue, setCue] = useState<Point | null>(null)
  const [object, setObject] = useState<Point | null>(null)
  const [pocket, setPocket] = useState<Point | null>(null)
  const [active, setActive] = useState<Step>('cue')

  const ghost = useMemo(() => {
    if (!object || !pocket) return null
    const u = norm(object, pocket)
    return { x: object.x - u.x * BALL_RADIUS * 2, y: object.y - u.y * BALL_RADIUS * 2 }
  }, [object, pocket])

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(URL.createObjectURL(file))
  }

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    if (active === 'cue') setCue(p)
    if (active === 'object') setObject(p)
    if (active === 'pocket') setPocket(p)
    const idx = steps.findIndex((s) => s.key === active)
    setActive(steps[Math.min(idx + 1, steps.length - 1)].key)
  }

  const reset = () => {
    setCue(null); setObject(null); setPocket(null); setActive('cue')
  }

  return (
    <main className="app">
      <header>
        <p className="eyebrow">PWA prototype</p>
        <h1>Billiard Aim Assistant</h1>
        <p>Foto meja → tap cue ball/object ball/pocket → ghost ball + aim line.</p>
      </header>

      <section className="panel">
        <label className="upload">
          Upload table photo
          <input type="file" accept="image/*" capture="environment" onChange={handleImage} />
        </label>
        <div className="steps">
          {steps.map((s) => <button key={s.key} className={active === s.key ? 'active' : ''} onClick={() => setActive(s.key)}>{s.label}</button>)}
          <button onClick={reset}>Reset</button>
        </div>
      </section>

      <section className="table" onClick={handleTap}>
        {image ? <img src={image} alt="Pool table" /> : <div className="placeholder">Upload foto meja dulu</div>}
        <svg className="overlay">
          {cue && <circle cx={cue.x} cy={cue.y} r={BALL_RADIUS} className="cue" />}
          {object && <circle cx={object.x} cy={object.y} r={BALL_RADIUS} className="object" />}
          {pocket && <circle cx={pocket.x} cy={pocket.y} r={12} className="pocket" />}
          {object && pocket && <line x1={object.x} y1={object.y} x2={pocket.x} y2={pocket.y} className="objectLine" />}
          {cue && ghost && <line x1={cue.x} y1={cue.y} x2={ghost.x} y2={ghost.y} className="aimLine" />}
          {ghost && <circle cx={ghost.x} cy={ghost.y} r={BALL_RADIUS} className="ghost" />}
        </svg>
      </section>

      <footer>Next: calibration, spin/rail prediction, saved shots.</footer>
    </main>
  )
}

export default App
