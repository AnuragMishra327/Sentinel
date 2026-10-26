import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from './firebase'

function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    if (loading) return

    setLoading(true)
    setError('')

    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('Google sign-in failed:', err)

      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled.')
      } else {
        setError('Unable to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const stars = Array.from({ length: 100 }, (_, i) => ({
    left: `${(i * 37.7) % 100}%`,
    top: `${(i * 61.3) % 100}%`,
    size: i % 17 === 0 ? 2 : i % 7 === 0 ? 1.4 : 0.8,
    opacity: 0.15 + ((i * 17) % 55) / 100,
    delay: `${(i % 12) * 0.35}s`,
  }))

  const meteors = [
    {
      left: '8%',
      delay: '0s',
      duration: '9s',
      scale: 0.72,
    },
    {
      left: '30%',
      delay: '5.3s',
      duration: '10.5s',
      scale: 0.5,
    },
    {
      left: '72%',
      delay: '2s',
      duration: '8s',
      scale: 0.9,
    },
    {
      left: '91%',
      delay: '6.8s',
      duration: '9.5s',
      scale: 0.58,
    },
  ]

  return (
    <div style={styles.page}>
      <style>{`

        @keyframes twinkle {
          0%, 100% {
            opacity: .15;
          }

          50% {
            opacity: .8;
          }
        }

        /*
          Entire meteor is rotated as ONE object.

          Fire -----> Rock

          Then whole thing is rotated diagonally.

          This guarantees the fire always remains
          directly behind the asteroid.
        */

        @keyframes meteorFall {
          0% {
            transform:
              translate3d(320px, -300px, 0)
              rotate(135deg);

            opacity: 0;
          }

          6% {
            opacity: 1;
          }

          88% {
            opacity: 1;
          }

          100% {
            transform:
              translate3d(-420px, 115vh, 0)
              rotate(135deg);

            opacity: 0;
          }
        }

        @keyframes rockSpin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes flamePulse {
          0%, 100% {
            transform: scaleX(.96);
            opacity: .8;
          }

          50% {
            transform: scaleX(1.05);
            opacity: 1;
          }
        }

        @keyframes smokePulse {
          0%, 100% {
            opacity: .12;
          }

          50% {
            opacity: .25;
          }
        }

        @keyframes sparkFly {
          0% {
            transform: translateX(0);
            opacity: 1;
          }

          100% {
            transform: translateX(-90px);
            opacity: 0;
          }
        }

        @keyframes horizonPulse {
          0%, 100% {
            opacity: .28;
          }

          50% {
            opacity: .5;
          }
        }

        .sentinel-google-button:hover:not(:disabled) {
          transform: translateY(-2px);

          background:
            #f1f1f3 !important;

          box-shadow:
            0 14px 45px rgba(0,0,0,.45) !important;
        }

        .sentinel-google-button:active:not(:disabled) {
          transform: translateY(0);
        }

        @media (max-width: 650px) {

          .sentinel-login-brand {
            top: 25px !important;
            left: 25px !important;
          }

          .sentinel-login-content {
            padding: 25px !important;
          }

          .sentinel-login-title {
            font-size: 43px !important;
          }

          .sentinel-bottom {
            font-size: 7px !important;
            letter-spacing: .1em !important;
          }
        }

      `}</style>

      {/* SPACE BACKGROUND */}

      <div style={styles.spaceGlowOne} />

      <div style={styles.spaceGlowTwo} />

      <div style={styles.spaceDust} />

      {/* STAR FIELD */}

      <div style={styles.starField}>

        {stars.map((star, index) => (

          <span
            key={index}

            style={{
              position: 'absolute',

              left: star.left,
              top: star.top,

              width: star.size,
              height: star.size,

              borderRadius: '50%',

              background: '#ffffff',

              opacity: star.opacity,

              boxShadow:
                star.size > 1
                  ? '0 0 5px rgba(255,255,255,.65)'
                  : 'none',

              animation:
                index % 7 === 0
                  ? `twinkle ${
                      4 + (index % 5)
                    }s ease-in-out ${
                      star.delay
                    } infinite`
                  : 'none',
            }}
          />

        ))}

      </div>

      {/* METEORS */}

      <div style={styles.meteorLayer}>

        {meteors.map((meteor, index) => (

          <div
            key={index}

            style={{
              ...styles.meteorFlight,

              left: meteor.left,

              animationDelay:
                meteor.delay,

              animationDuration:
                meteor.duration,
            }}
          >

            <div
              style={{
                ...styles.meteorScale,

                transform:
                  `scale(${meteor.scale})`,
              }}
            >

              {/* LONG SMOKE TRAIL */}

              <div style={styles.smokeTrail} />

              {/* OUTER FIRE */}

              <div style={styles.outerFire} />

              {/* MAIN ORANGE FLAME */}

              <div style={styles.mainFire} />

              {/* HOT WHITE/YELLOW CORE */}

              <div style={styles.hotCore} />

              {/* EMBERS */}

              {[0, 1, 2, 3, 4, 5].map(
                (spark) => (

                  <span
                    key={spark}

                    style={{
                      ...styles.spark,

                      left:
                        40 + spark * 18,

                      top:
                        37 +
                        ((spark % 3) - 1) * 7,

                      animationDelay:
                        `${spark * 0.15}s`,
                    }}
                  />

                )
              )}

              {/* ASTEROID */}

              <div style={styles.rockContainer}>

                <div style={styles.heatGlow} />

                <div style={styles.rock}>

                  <div style={styles.craterOne} />

                  <div style={styles.craterTwo} />

                  <div style={styles.craterThree} />

                  <div style={styles.rockHighlight} />

                </div>

              </div>

            </div>

          </div>

        ))}

      </div>

      {/* LOWER ATMOSPHERE */}

      <div style={styles.horizon} />

      <div style={styles.horizonLine} />

      {/* BRAND */}

      <div
        style={styles.brand}
        className="sentinel-login-brand"
      >

        <span style={styles.brandIcon}>
          ◉
        </span>

        <span>
          SENTINEL
        </span>

      </div>

      {/* LOGIN */}

      <main
        style={styles.content}
        className="sentinel-login-content"
      >

        <div style={styles.accessLabel}>

          <span style={styles.accessDot} />

          SECURE ACCESS

        </div>

        <h1
          style={styles.title}
          className="sentinel-login-title"
        >
          Welcome back.
        </h1>

        <p style={styles.description}>
          Sign in to continue to your personal Sentinel.
        </p>

        <button
          className="sentinel-google-button"

          onClick={handleGoogleLogin}

          disabled={loading}

          style={{
            ...styles.googleButton,

            opacity:
              loading ? 0.65 : 1,

            cursor:
              loading
                ? 'wait'
                : 'pointer',
          }}
        >

          <span style={styles.googleLogo}>
            G
          </span>

          {loading
            ? 'Connecting...'
            : 'Continue with Google'}

        </button>

        {error && (

          <p style={styles.error}>
            {error}
          </p>

        )}

        <p style={styles.protected}>
          Protected by Google Authentication
        </p>

      </main>

      {/* BOTTOM TAGLINE */}

      <div
        style={styles.bottom}
        className="sentinel-bottom"
      >

        <span style={styles.bottomDot} />

        SENTINEL

        <span>·</span>

        IT ACTIVATES WHEN SOMETHING CHANGES

      </div>

    </div>
  )
}

const styles = {

  page: {
    minHeight: '100vh',

    width: '100%',

    overflow: 'hidden',

    position: 'relative',

    display: 'flex',

    alignItems: 'center',

    justifyContent: 'center',

    background:
      'linear-gradient(180deg, #020306 0%, #04050a 42%, #07060a 73%, #0d0808 100%)',

    color: '#fafafa',

    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  spaceGlowOne: {
    position: 'absolute',

    width: '80vw',

    height: '65vh',

    top: '-35vh',

    left: '-20vw',

    background:
      'radial-gradient(ellipse, rgba(38,42,70,.25), transparent 67%)',

    filter: 'blur(40px)',
  },

  spaceGlowTwo: {
    position: 'absolute',

    width: '65vw',

    height: '55vh',

    right: '-30vw',

    top: '15vh',

    background:
      'radial-gradient(ellipse, rgba(42,28,53,.18), transparent 70%)',

    filter: 'blur(55px)',
  },

  spaceDust: {
    position: 'absolute',

    inset: 0,

    background:
      'radial-gradient(ellipse at 70% 20%, rgba(255,255,255,.015), transparent 35%), radial-gradient(ellipse at 20% 65%, rgba(88,91,130,.035), transparent 35%)',

    pointerEvents: 'none',
  },

  starField: {
    position: 'absolute',

    inset: 0,

    zIndex: 1,

    pointerEvents: 'none',
  },

  meteorLayer: {
    position: 'absolute',

    inset: 0,

    overflow: 'hidden',

    zIndex: 2,

    pointerEvents: 'none',
  },

  /*
    IMPORTANT:

    This container contains ONE STRAIGHT meteor.

        FIRE FIRE FIRE ===== 🪨

    Then the entire container is rotated
    by the animation.

    Therefore the fire cannot separate
    from the asteroid.
  */

  meteorFlight: {
    position: 'absolute',

    top: '-120px',

    width: 270,

    height: 80,

    animationName:
      'meteorFall',

    animationTimingFunction:
      'linear',

    animationIterationCount:
      'infinite',

    transformOrigin:
      'center center',
  },

  meteorScale: {
    position: 'relative',

    width: 270,

    height: 80,

    transformOrigin:
      'right center',
  },

  /*
    EVERYTHING BELOW IS HORIZONTAL.

    Nothing is individually rotated.
  */

  smokeTrail: {
    position: 'absolute',

    right: 34,

    top: 20,

    width: 230,

    height: 40,

    borderRadius:
      '100% 20% 20% 100%',

    background:
      'linear-gradient(90deg, transparent 0%, rgba(90,65,60,.07) 30%, rgba(130,74,50,.17) 72%, rgba(255,96,20,.2) 100%)',

    filter:
      'blur(13px)',

    animation:
      'smokePulse 1.3s ease-in-out infinite',
  },

  outerFire: {
    position: 'absolute',

    right: 33,

    top: 27,

    width: 190,

    height: 26,

    borderRadius:
      '100% 20% 20% 100%',

    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,56,0,.08) 20%, rgba(255,72,5,.28) 55%, rgba(255,129,26,.7) 88%, rgba(255,188,77,.9) 100%)',

    filter:
      'blur(7px)',

    animation:
      'flamePulse .35s ease-in-out infinite',

    transformOrigin:
      'right center',
  },

  mainFire: {
    position: 'absolute',

    right: 32,

    top: 32,

    width: 145,

    height: 16,

    borderRadius:
      '100% 20% 20% 100%',

    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,65,0,.18) 20%, #ff6611 58%, #ffb34d 88%, #ffe0a3 100%)',

    filter:
      'blur(3px)',

    animation:
      'flamePulse .25s ease-in-out infinite',

    transformOrigin:
      'right center',
  },

  hotCore: {
    position: 'absolute',

    right: 30,

    top: 37,

    width: 95,

    height: 6,

    borderRadius: 100,

    background:
      'linear-gradient(90deg, transparent 0%, #ff7a19 32%, #ffd17f 72%, #fff6dd 100%)',

    filter:
      'blur(1px)',

    boxShadow:
      '0 0 10px rgba(255,111,20,.7)',
  },

  /*
    ROCK IS ALWAYS AT THE RIGHT END
    OF THE STRAIGHT TRAIL.
  */

  rockContainer: {
    position: 'absolute',

    right: 0,

    top: 19,

    width: 43,

    height: 43,

    zIndex: 10,
  },

  heatGlow: {
    position: 'absolute',

    inset: -7,

    borderRadius: '50%',

    background:
      'radial-gradient(circle, rgba(255,148,45,.22), rgba(255,69,4,.08) 48%, transparent 72%)',

    filter:
      'blur(6px)',
  },

  rock: {
    position: 'absolute',

    inset: 0,

    borderRadius:
      '48% 56% 43% 58% / 52% 42% 61% 47%',

    background:
      'radial-gradient(circle at 30% 27%, #82766c 0%, #554d46 17%, #37322e 40%, #211f1c 68%, #11100f 100%)',

    boxShadow:
      'inset -8px -8px 11px rgba(0,0,0,.7), inset 5px 4px 7px rgba(255,255,255,.09), -4px 0 10px rgba(255,102,24,.28)',

    animation:
      'rockSpin 5s linear infinite',
  },

  craterOne: {
    position: 'absolute',

    width: 11,

    height: 9,

    left: 8,

    top: 8,

    borderRadius: '50%',

    background:
      'radial-gradient(circle at 65% 65%, #39342f, #171615)',

    boxShadow:
      'inset 2px 2px 3px rgba(0,0,0,.7), -1px -1px 2px rgba(255,255,255,.07)',
  },

  craterTwo: {
    position: 'absolute',

    width: 7,

    height: 7,

    right: 7,

    top: 16,

    borderRadius: '50%',

    background:
      '#24211e',

    boxShadow:
      'inset 2px 2px 3px rgba(0,0,0,.8)',
  },

  craterThree: {
    position: 'absolute',

    width: 8,

    height: 6,

    left: 17,

    bottom: 6,

    borderRadius: '50%',

    background:
      '#292521',

    boxShadow:
      'inset 2px 1px 3px rgba(0,0,0,.75)',
  },

  rockHighlight: {
    position: 'absolute',

    width: 14,

    height: 22,

    left: 0,

    top: 5,

    borderRadius: '50%',

    background:
      'linear-gradient(90deg, rgba(255,127,37,.25), transparent)',

    filter:
      'blur(2px)',
  },

  spark: {
    position: 'absolute',

    width: 2,

    height: 2,

    borderRadius: '50%',

    background:
      '#ff9d3c',

    boxShadow:
      '0 0 5px #ff6418',

    animation:
      'sparkFly 1.1s linear infinite',
  },

  horizon: {
    position: 'absolute',

    width: '115%',

    height: 180,

    left: '-7.5%',

    bottom: -130,

    borderRadius: '50%',

    background:
      'radial-gradient(ellipse, rgba(255,86,24,.1) 0%, rgba(145,57,43,.045) 32%, transparent 68%)',

    filter:
      'blur(24px)',

    animation:
      'horizonPulse 5s ease-in-out infinite',

    zIndex: 2,
  },

  horizonLine: {
    position: 'absolute',

    bottom: 0,

    left: '10%',

    width: '80%',

    height: 1,

    background:
      'linear-gradient(90deg, transparent, rgba(255,110,49,.15), rgba(255,184,100,.22), rgba(255,110,49,.15), transparent)',

    zIndex: 3,
  },

  brand: {
    position: 'absolute',

    top: 38,

    left: 48,

    zIndex: 20,

    display: 'flex',

    alignItems: 'center',

    gap: 10,

    fontSize: 13,

    fontWeight: 650,

    letterSpacing: '.21em',

    color: '#ededf0',
  },

  brandIcon: {
    color: '#a78bfa',

    fontSize: 20,

    textShadow:
      '0 0 14px rgba(167,139,250,.55)',
  },

  content: {
    position: 'relative',

    zIndex: 30,

    width: '100%',

    maxWidth: 500,

    padding: 35,

    textAlign: 'center',
  },

  accessLabel: {
    display: 'inline-flex',

    alignItems: 'center',

    gap: 8,

    marginBottom: 25,

    color: '#777780',

    fontSize: 9,

    fontWeight: 600,

    letterSpacing: '.22em',
  },

  accessDot: {
    width: 5,

    height: 5,

    borderRadius: '50%',

    background: '#a78bfa',

    boxShadow:
      '0 0 9px rgba(167,139,250,.8)',
  },

  title: {
    margin: 0,

    fontSize:
      'clamp(43px, 6vw, 65px)',

    fontWeight: 500,

    letterSpacing: '-.055em',

    lineHeight: 1,

    color: '#f7f7f8',

    textShadow:
      '0 2px 25px rgba(0,0,0,.5)',
  },

  description: {
    margin:
      '21px auto 36px',

    color: '#85858e',

    fontSize: 14,

    lineHeight: 1.7,
  },

  googleButton: {
    width: '100%',

    maxWidth: 350,

    minHeight: 54,

    margin: '0 auto',

    border:
      '1px solid rgba(255,255,255,.85)',

    borderRadius: 10,

    background: '#ffffff',

    color: '#171719',

    display: 'flex',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 12,

    fontSize: 13,

    fontWeight: 600,

    transition:
      'transform .2s ease, box-shadow .2s ease, background .2s ease',

    boxShadow:
      '0 12px 35px rgba(0,0,0,.28)',
  },

  googleLogo: {
    display: 'grid',

    placeItems: 'center',

    width: 25,

    height: 25,

    color: '#4285F4',

    fontSize: 16,

    fontWeight: 800,
  },

  error: {
    marginTop: 15,

    color: '#fda4af',

    fontSize: 11,
  },

  protected: {
    marginTop: 18,

    color: '#505058',

    fontSize: 9,

    letterSpacing: '.07em',
  },

  bottom: {
    position: 'absolute',

    bottom: 29,

    left: '50%',

    transform:
      'translateX(-50%)',

    zIndex: 30,

    display: 'flex',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    width:
      'calc(100% - 40px)',

    color: '#414149',

    fontSize: 8,

    letterSpacing: '.17em',

    whiteSpace: 'nowrap',
  },

  bottomDot: {
    width: 4,

    height: 4,

    borderRadius: '50%',

    background: '#7c3aed',

    boxShadow:
      '0 0 8px rgba(124,58,237,.75)',
  },
}

export default LoginPage