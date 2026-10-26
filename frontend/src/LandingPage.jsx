import { useEffect, useRef } from 'react'
import './LandingPage.css'

function LandingPage({ onEnter }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let animationFrame

    const stars = []

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createStar = () => {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * Math.max(
        canvas.width,
        canvas.height
      )

      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        z: Math.random() * canvas.width,
        previousZ: 0
      }
    }

    const createStars = () => {
      stars.length = 0

      const starCount = Math.min(
        700,
        Math.floor(
          (window.innerWidth * window.innerHeight) / 2500
        )
      )

      for (let i = 0; i < starCount; i++) {
        stars.push(createStar())
      }
    }

    resizeCanvas()
    createStars()

    const animate = () => {
      ctx.fillStyle = 'rgba(2, 3, 6, 0.32)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      stars.forEach((star) => {
        star.previousZ = star.z

        star.z -= 8

        if (star.z <= 1) {
          Object.assign(star, createStar())
          star.z = canvas.width
          star.previousZ = star.z
        }

        const scale = 400 / star.z

        const x = centerX + star.x * scale
        const y = centerY + star.y * scale

        const previousScale = 400 / star.previousZ

        const previousX =
          centerX + star.x * previousScale

        const previousY =
          centerY + star.y * previousScale

        const size = Math.max(
          0.3,
          (1 - star.z / canvas.width) * 3
        )

        const opacity = Math.min(
          1,
          (1 - star.z / canvas.width) * 1.5
        )

        if (
          x < -50 ||
          x > canvas.width + 50 ||
          y < -50 ||
          y > canvas.height + 50
        ) {
          return
        }

        ctx.beginPath()

        ctx.moveTo(previousX, previousY)
        ctx.lineTo(x, y)

        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.lineWidth = size

        ctx.stroke()

        ctx.beginPath()

        ctx.arc(
          x,
          y,
          size,
          0,
          Math.PI * 2
        )

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.fill()
      })

      animationFrame =
        requestAnimationFrame(animate)
    }

    animate()

    window.addEventListener(
      'resize',
      () => {
        resizeCanvas()
        createStars()
      }
    )

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <main className="landing-page">

      <canvas
        ref={canvasRef}
        className="star-field"
      />

      <div className="space-glow"></div>

      <header className="landing-nav">
        <div className="landing-logo">
          <span className="landing-logo-mark">◉</span>
          <span>SENTINEL</span>
        </div>

        <div className="landing-nav-status">
          <span></span>
          SYSTEM ONLINE
        </div>
      </header>

      <section className="landing-content">

        <div className="landing-orbit">
          <div className="orbit-ring orbit-ring-one"></div>
          <div className="orbit-ring orbit-ring-two"></div>

          <div className="landing-core">
            <span></span>
          </div>
        </div>

        <p className="landing-eyebrow">
          AUTONOMOUS MONITORING SYSTEM
        </p>

        <h1>
          It activates when
          <span> something changes.</span>
        </h1>

        <p className="landing-description">
          Sentinel continuously watches the information that matters
          to you, understands meaningful changes, and lets you know
          when something deserves your attention.
        </p>

        <button
          className="landing-button"
          onClick={onEnter}
        >
          <span>Explore Sentinel</span>
          <span className="button-arrow">→</span>
        </button>

        <div className="landing-hint">
          <span className="hint-line"></span>
          Observe · Understand · Act
          <span className="hint-line"></span>
        </div>

      </section>
    </main>
  )
}

export default LandingPage