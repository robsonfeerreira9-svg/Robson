'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  imagens: string[]
  alt?: string
  className?: string
}

export default function Viewer360({ imagens, alt = 'Produto', className = '' }: Props) {
  const [frame, setFrame] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const startXRef   = useRef(0)
  const frameInicioRef = useRef(0)
  const autoRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const girouRef    = useRef(false)

  const total = imagens.length

  // Giro automático uma vez ao montar (demonstra interatividade)
  useEffect(() => {
    if (total < 2 || girouRef.current) return
    girouRef.current = true
    let f = 0
    autoRef.current = setInterval(() => {
      f++
      setFrame(f % total)
      if (f >= total) {
        clearInterval(autoRef.current!)
        autoRef.current = null
      }
    }, 55)
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [total])

  function pararAuto() {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (total < 2) return
    pararAuto()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setArrastando(true)
    startXRef.current = e.clientX
    frameInicioRef.current = frame
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando || total < 2) return
    const dx      = e.clientX - startXRef.current
    // 10 pixels por frame — mais intuitivo
    const delta   = Math.round(-dx / 10)
    const novoFrame = ((frameInicioRef.current + delta) % total + total) % total
    setFrame(novoFrame)
  }

  function onPointerUp() { setArrastando(false) }

  if (total === 0) return null

  return (
    <div
      className={`relative select-none overflow-hidden bg-white rounded-2xl ${
        arrastando ? 'cursor-grabbing' : total > 1 ? 'cursor-grab' : 'cursor-zoom-in'
      } ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Todas as imagens sobrepostas; só a ativa é visível */}
      {imagens.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt={`${alt} — ângulo ${i + 1}`}
          draggable={false}
          className={`w-full h-full object-contain transition-opacity duration-75 ${
            i === frame ? 'opacity-100 relative' : 'opacity-0 absolute inset-0'
          }`}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {/* Badge 360° */}
      {total > 1 && (
        <div className="absolute top-3 right-3 bg-black/65 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 pointer-events-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          360°
        </div>
      )}

      {/* Indicador de frame */}
      {total > 1 && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
          {imagens.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-150 ${
                i === frame
                  ? 'w-4 h-1.5 bg-[#F5C518]'
                  : 'w-1.5 h-1.5 bg-black/20'
              }`}
            />
          ))}
        </div>
      )}

      {/* Hint "arraste" */}
      {total > 1 && !arrastando && (
        <div className="absolute bottom-8 inset-x-0 flex justify-center pointer-events-none">
          <span className="text-[10px] text-black/30 font-medium tracking-wide">
            ← Arraste para girar →
          </span>
        </div>
      )}
    </div>
  )
}
