import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent } from 'react'
import './App.css'

type Point = { x: number; y: number }
type Tool = 'cue' | 'object' | 'pocket' | 'calibrate'
type MarkerKey = 'cue' | 'object' | 'pocket' | 'calA' | 'calB'

const tools: { key: Tool; label: string; hint: string }[] = [
  { key: 'cue', label: '1 Cue', hint: 'tap/drag cue ball center' },
  { key: 'object', label: '2 Object', hint: 'tap/drag target ball center' },
  { key: 'pocket', label: '3 Pocket', hint: 'tap target pocket' },
  { key: 'calibrate', label: 'Calibrate', hint: 'tap two edges of any ball' },
]
const markerOrder: MarkerKey[] = ['cue', 'object', 'pocket', 'calA', 'calB']
const defaultRadius = 18
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const unit = (from: Point, to: Point) => {
  const d = dist(from, to) || 1
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d }
}
const add = (p: Point, v: Point, m = 1) => ({ x: p.x + v.x * m, y: p.y + v.y * m })

function App() {
  const [image, setImage] = useState('')
  const [tool, setTool] = useState<Tool>('cue')
  const [cue, setCue] = useState<Point | null>(null)
  const [object, setObject] = useState<Point | null>(null)
  const [pocket, setPocket] = useState<Point | null>(null)
  const [calA, setCalA] = useState<Point | null>(null)
  const [calB, setCalB] = useState<Point | null>(null)
  const [dragging, setDragging] = useState<MarkerKey | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const ballRadius = useMemo(() => calA && calB ? clamp(dist(calA, calB) / 2, 8, 90) : defaultRadius, [calA, calB])
  const geometry = useMemo(() => {
    if (!object || !pocket) return null
    const objToPocket = unit(object, pocket)
    const ghost = add(object, objToPocket, -ballRadius * 2)
    const contact = add(object, objToPocket, -ballRadius)
    const tangent = { x: -objToPocket.y, y: objToPocket.x }
    const tangentA = add(object, tangent, ballRadius * 2.4)
    const tangentB = add(object, tangent, -ballRadius * 2.4)
    const cueToGhost = cue ? unit(cue, ghost) : null
    const cut = cue && cueToGhost ? Math.acos(clamp(cueToGhost.x * objToPocket.x + cueToGhost.y * objToPocket.y, -1, 1)) * 180 / Math.PI : null
    return { ghost, contact, tangentA, tangentB, cut }
  }, [cue, object, pocket, ballRadius])

  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      if (!dragging || !stageRef.current) return
      const r = stageRef.current.getBoundingClientRect()
      place(dragging, { x: e.clientX - r.left, y: e.clientY - r.top })
    }
    const up = () => setDragging(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [dragging])

  const place = (key: MarkerKey, p: Point) => {
    if (key === 'cue') setCue(p)
    if (key === 'object') setObject(p)
    if (key === 'pocket') setPocket(p)
    if (key === 'calA') setCalA(p)
    if (key === 'calB') setCalB(p)
  }
  const pointFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const handleStageTap = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.marker) return
    const p = pointFromEvent(e)
    if (tool === 'calibrate') {
      if (!calA || (calA && calB)) { setCalA(p); setCalB(null) } else setCalB(p)
      return
    }
    place(tool, p)
    if (tool === 'cue') setTool('object')
    if (tool === 'object') setTool('pocket')
  }
  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImage(URL.createObjectURL(file))
  }
  const resetShot = () => { setCue(null); setObject(null); setPocket(null); setTool('cue') }
  const resetAll = () => { resetShot(); setCalA(null); setCalB(null); setImage('') }

  const markers: Record<MarkerKey, Point | null> = { cue, object, pocket, calA, calB }

  return (
    <main className="app">
      <header className="hero">
        <div><p className="eyebrow">v0.2 prototype</p><h1>Billiard Aim Assistant</h1><p>Camera-ready aiming overlay: ghost ball, contact point, cut angle, cue tangent path.</p></div>
        <div className="metric"><span>{Math.round(ballRadius * 2)}px</span><small>ball diameter</small></div>
      </header>

      <section className="toolbar">
        <label className="capture">📷 Capture / upload<input type="file" accept="image/*" capture="environment" onChange={handleImage} /></label>
        <div className="toolgrid">{tools.map(t => <button key={t.key} className={tool === t.key ? 'active' : ''} onClick={() => setTool(t.key)}><b>{t.label}</b><small>{t.hint}</small></button>)}</div>
        <div className="actions"><button onClick={resetShot}>Reset shot</button><button onClick={resetAll}>Clear all</button></div>
      </section>

      <section className="stage" ref={stageRef} onPointerDown={handleStageTap}>
        {image ? <img src={image} alt="Pool table" /> : <div className="empty"><b>Ambil foto meja</b><span>Lalu tap cue → object → pocket. Marker bisa di-drag.</span></div>}
        <svg className="overlay">
          {object && pocket && <line x1={object.x} y1={object.y} x2={pocket.x} y2={pocket.y} className="objectLine" />}
          {cue && geometry?.ghost && <line x1={cue.x} y1={cue.y} x2={geometry.ghost.x} y2={geometry.ghost.y} className="aimLine" />}
          {geometry && <><circle cx={geometry.ghost.x} cy={geometry.ghost.y} r={ballRadius} className="ghost" /><circle cx={geometry.contact.x} cy={geometry.contact.y} r="5" className="contact" /><line x1={geometry.tangentA.x} y1={geometry.tangentA.y} x2={geometry.tangentB.x} y2={geometry.tangentB.y} className="tangent" /></>}
          {calA && calB && <line x1={calA.x} y1={calA.y} x2={calB.x} y2={calB.y} className="calLine" />}
        </svg>
        {markerOrder.map(k => markers[k] && <button key={k} data-marker={k} className={`marker ${k}`} style={{ left: markers[k]!.x, top: markers[k]!.y, width: k === 'pocket' ? 26 : ballRadius * 2, height: k === 'pocket' ? 26 : ballRadius * 2 }} onPointerDown={(e) => { e.stopPropagation(); setDragging(k) }}>{k === 'cue' ? 'C' : k === 'object' ? 'O' : k === 'pocket' ? 'P' : ''}</button>)}
      </section>

      <section className="readout">
        <div><b>Status</b><span>{cue && object && pocket ? 'Shot ready' : tools.find(t => t.key === tool)?.hint}</span></div>
        <div><b>Cut angle</b><span>{geometry?.cut ? `${geometry.cut.toFixed(1)}°` : '—'}</span></div>
        <div><b>Ghost ball</b><span>{geometry ? `${Math.round(geometry.ghost.x)}, ${Math.round(geometry.ghost.y)}` : '—'}</span></div>
      </section>
    </main>
  )
}

export default App
