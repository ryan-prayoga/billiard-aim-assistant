import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent } from 'react'
import './App.css'

type Point = { x: number; y: number }
type Tool = 'cue' | 'object' | 'pocket' | 'calibrate' | 'corner'
type MarkerKey = 'cue' | 'object' | 'pocket' | 'calA' | 'calB' | 'corner1' | 'corner2' | 'corner3' | 'corner4'

const tools: { key: Tool; label: string; hint: string }[] = [
  { key: 'cue', label: '1 Cue', hint: 'tap/drag cue ball center' },
  { key: 'object', label: '2 Object', hint: 'tap/drag target ball center' },
  { key: 'pocket', label: '3 Pocket', hint: 'tap target pocket' },
  { key: 'calibrate', label: 'Calibrate', hint: 'tap two edges of any ball' },
  { key: 'corner', label: 'Table corners', hint: 'tap 4 table corners clockwise' },
]
const markerOrder: MarkerKey[] = ['cue', 'object', 'pocket', 'calA', 'calB', 'corner1', 'corner2', 'corner3', 'corner4']
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
  const [corner1, setCorner1] = useState<Point | null>(null)
  const [corner2, setCorner2] = useState<Point | null>(null)
  const [corner3, setCorner3] = useState<Point | null>(null)
  const [corner4, setCorner4] = useState<Point | null>(null)
  const [cornerStep, setCornerStep] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [selected, setSelected] = useState<MarkerKey | null>(null)
  const [dragging, setDragging] = useState<MarkerKey | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const corners = useMemo(() => [corner1, corner2, corner3, corner4].filter(Boolean) as Point[], [corner1, corner2, corner3, corner4])
  const pocketPresets = useMemo(() => {
    if (corners.length !== 4) return []
    const [tl, tr, br, bl] = corners
    return [tl, { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 }, tr, br, { x: (br.x + bl.x) / 2, y: (br.y + bl.y) / 2 }, bl]
  }, [corners])

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
      place(dragging, screenToWorld(e.clientX - r.left, e.clientY - r.top))
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
    if (key === 'corner1') setCorner1(p)
    if (key === 'corner2') setCorner2(p)
    if (key === 'corner3') setCorner3(p)
    if (key === 'corner4') setCorner4(p)
  }
  const screenToWorld = (x: number, y: number): Point => ({ x: (x - pan.x) / zoom, y: (y - pan.y) / zoom })
  const pointFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return screenToWorld(e.clientX - r.left, e.clientY - r.top)
  }
  const nudge = (dx: number, dy: number) => {
    if (!selected || !markers[selected]) return
    const p = markers[selected]!
    place(selected, { x: p.x + dx, y: p.y + dy })
  }
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const handleStageTap = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.marker) return
    const p = pointFromEvent(e)
    if (tool === 'calibrate') {
      if (!calA || (calA && calB)) { setCalA(p); setCalB(null) } else setCalB(p)
      return
    }
    if (tool === 'corner') {
      const keys: MarkerKey[] = ['corner1', 'corner2', 'corner3', 'corner4']
      place(keys[cornerStep % 4], p)
      setCornerStep((cornerStep + 1) % 4)
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
  const resetCorners = () => { setCorner1(null); setCorner2(null); setCorner3(null); setCorner4(null); setCornerStep(0) }
  const resetAll = () => { resetShot(); setCalA(null); setCalB(null); resetCorners(); setImage('') }

  const markers: Record<MarkerKey, Point | null> = { cue, object, pocket, calA, calB, corner1, corner2, corner3, corner4 }

  return (
    <main className="app">
      <header className="hero">
        <div><p className="eyebrow">v0.3 prototype</p><h1>Billiard Aim Assistant</h1><p>Camera-ready aiming overlay: ghost ball, contact point, cut angle, cue tangent path.</p></div>
        <div className="metric"><span>{Math.round(ballRadius * 2)}px</span><small>ball diameter</small></div>
      </header>

      <section className="toolbar">
        <label className="capture">📷 Capture / upload<input type="file" accept="image/*" capture="environment" onChange={handleImage} /></label>
        <div className="toolgrid">{tools.map(t => <button key={t.key} className={tool === t.key ? 'active' : ''} onClick={() => setTool(t.key)}><b>{t.label}</b><small>{t.hint}</small></button>)}</div>
        <div className="actions"><button onClick={resetShot}>Reset shot</button><button onClick={resetCorners}>Reset corners</button><button onClick={resetAll}>Clear all</button><label className="zoom">Zoom {zoom.toFixed(1)}x<input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label><button onClick={() => setPan(p => ({ ...p, y: p.y + 30 }))}>↑ Pan</button><button onClick={() => setPan(p => ({ ...p, y: p.y - 30 }))}>↓ Pan</button><button onClick={() => setPan(p => ({ ...p, x: p.x + 30 }))}>← Pan</button><button onClick={() => setPan(p => ({ ...p, x: p.x - 30 }))}>→ Pan</button><button onClick={resetView}>Reset view</button></div>
        {pocketPresets.length > 0 && <div className="pockets">{pocketPresets.map((p, i) => <button key={i} onClick={() => setPocket(p)}>Pocket {i + 1}</button>)}</div>}
      </section>

      <section className="stage" ref={stageRef} onPointerDown={handleStageTap}>
        <div className="zoomLayer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {image ? <img src={image} alt="Pool table" /> : <div className="empty"><b>Ambil foto meja</b><span>Lalu tap cue → object → pocket. Marker bisa di-drag.</span></div>}
        <svg className="overlay">
          {corners.length === 4 && <polygon points={corners.map(p => `${p.x},${p.y}`).join(' ')} className="tablePoly" />}
          {pocketPresets.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="9" className="presetPocket" />)}
          {object && pocket && <line x1={object.x} y1={object.y} x2={pocket.x} y2={pocket.y} className="objectLine" />}
          {cue && geometry?.ghost && <line x1={cue.x} y1={cue.y} x2={geometry.ghost.x} y2={geometry.ghost.y} className="aimLine" />}
          {geometry && <><circle cx={geometry.ghost.x} cy={geometry.ghost.y} r={ballRadius} className="ghost" /><circle cx={geometry.contact.x} cy={geometry.contact.y} r="5" className="contact" /><line x1={geometry.tangentA.x} y1={geometry.tangentA.y} x2={geometry.tangentB.x} y2={geometry.tangentB.y} className="tangent" /></>}
          {calA && calB && <line x1={calA.x} y1={calA.y} x2={calB.x} y2={calB.y} className="calLine" />}
        </svg>
        {markerOrder.map(k => markers[k] && <button key={k} data-marker={k} className={`marker ${k} ${selected === k ? 'selected' : ''}`} style={{ left: markers[k]!.x, top: markers[k]!.y, width: k === 'pocket' ? 26 : ballRadius * 2, height: k === 'pocket' ? 26 : ballRadius * 2 }} onPointerDown={(e) => { e.stopPropagation(); setSelected(k); setDragging(k) }}>{k === 'cue' ? 'C' : k === 'object' ? 'O' : k === 'pocket' ? 'P' : k.startsWith('corner') ? k.slice(-1) : ''}</button>)}
        </div>
      </section>

      <section className="readout">
        <div><b>Status</b><span>{cue && object && pocket ? 'Shot ready' : tools.find(t => t.key === tool)?.hint}</span></div>
        <div><b>Table corners</b><span>{corners.length}/4</span></div>
        <div><b>Cut angle</b><span>{geometry?.cut ? `${geometry.cut.toFixed(1)}°` : '—'}</span></div>
        <div><b>Ghost ball</b><span>{geometry ? `${Math.round(geometry.ghost.x)}, ${Math.round(geometry.ghost.y)}` : '—'}</span></div>
        <div className="nudge"><b>Nudge {selected ?? '—'}</b><span><button onClick={() => nudge(0, -1)}>↑</button><button onClick={() => nudge(-1, 0)}>←</button><button onClick={() => nudge(1, 0)}>→</button><button onClick={() => nudge(0, 1)}>↓</button></span></div>
      </section>
    </main>
  )
}

export default App
