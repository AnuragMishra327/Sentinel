import LandingPage from './LandingPage'
import LoginPage from './LoginPage'
import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import {
  enablePushNotifications,
  listenForForegroundNotifications,
} from './notifications'
import './App.css'

const API =
  import.meta.env.VITE_API_URL || 'http://localhost:5000'

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activePage, setActivePage] = useState('Dashboard')
  const [showModal, setShowModal] = useState(false)

  const [monitors, setMonitors] = useState(() => {
    try {
      const saved = localStorage.getItem('sentinel-monitors')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      console.log('Unable to restore saved monitors')
    }

    return [
      {
        name: 'UP Scholarship Portal',
        url: '',
        description: 'Monitoring for meaningful updates',
        lastChecked: '2 min ago',
      },
      {
        name: 'Government Schemes',
        url: '',
        description: 'Monitoring for new announcements',
        lastChecked: '5 min ago',
      },
    ]
  })

  const [monitorUrl, setMonitorUrl] = useState('')
  const [addingMonitor, setAddingMonitor] = useState(false)

  const [activity, setActivity] = useState([
    {
      source: 'UP Scholarship Portal',
      action: 'Checked for updates',
      time: '2 min ago',
      status: 'NO CHANGE',
    },
    {
      source: 'Government Schemes',
      action: 'Checked for updates',
      time: '5 min ago',
      status: 'NO CHANGE',
    },
  ])

  const [alerts, setAlerts] = useState([])
  const [liveTime, setLiveTime] = useState(new Date())
  const [health, setHealth] = useState(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [healthCheckedAt, setHealthCheckedAt] = useState(null)
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const seenAlertIds = useRef(new Set())
  const alertsInitialized = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = listenForForegroundNotifications((payload) => {
      const title =
        payload.notification?.title ||
        payload.data?.title ||
        'Sentinel — Change Detected'

      const body =
        payload.notification?.body ||
        payload.data?.body ||
        'Sentinel detected an important change.'

      showBrowserNotification(
        title,
        body,
        `sentinel-fcm-${Date.now()}`
      )
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sentinel-monitors', JSON.stringify(monitors))
    } catch {
      console.log('Unable to save monitors')
    }
  }, [monitors])

  const showBrowserNotification = (title, body, tag) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    try {
      const notification = new Notification(title, {
        body,
        tag,
        requireInteraction: true,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch {
      console.log('Unable to display browser notification')
    }
  }

  const enableNotifications = async () => {
  try {
    const token = await enablePushNotifications()

    if (token) {
      const response = await fetch(`${API}/api/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            'Unable to register this device with Sentinel.'
        )
      }

      setNotificationPermission('granted')

      showBrowserNotification(
        'Sentinel notifications enabled',
        'Push notifications are now enabled on this device.',
        'sentinel-notifications-enabled'
      )

      console.log(
        'Sentinel push notifications enabled and registered with backend.'
      )
    }
  } catch (error) {
    console.error(
      'Unable to enable Sentinel push notifications:',
      error
    )

    if ('Notification' in window) {
      setNotificationPermission(
        Notification.permission
      )
    }

    alert(
      error?.message ||
        'Unable to enable Sentinel push notifications on this device.'
    )
  }
}

useEffect(() => {
  if (!user) return

  const registerSavedPushToken = async () => {
    const token =
      localStorage.getItem(
        'sentinel-fcm-token'
      )

    if (!token) return

    try {
      const response = await fetch(
        `${API}/api/push-token`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            token,
          }),
        }
      )

      const data =
        await response.json()

      if (
        response.ok &&
        data.success
      ) {
        console.log(
          'Sentinel FCM device registered with backend.'
        )
      }
    } catch (error) {
      console.error(
        'Unable to register saved FCM token:',
        error
      )
    }
  }

  registerSavedPushToken()
}, [user])
const disableNotifications = async () => {
  try {
    const token = localStorage.getItem('sentinel-fcm-token')

    if (token) {
      const response = await fetch(`${API}/api/push-token`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'Unable to disable Sentinel notifications.'
        )
      }
    }

    localStorage.removeItem('sentinel-fcm-token')

    setNotificationPermission(
      'Notification' in window
        ? Notification.permission
        : 'unsupported'
    )

    console.log(
      'Sentinel push notifications disabled on this device.'
    )
  } catch (error) {
    console.error(
      'Unable to disable Sentinel push notifications:',
      error
    )

    alert(
      error?.message ||
        'Unable to disable Sentinel notifications on this device.'
    )
  }
}

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(`${API}/api/alerts`)
        const data = await response.json()

        if (response.ok && data.success) {
          const incomingAlerts = Array.isArray(data.alerts) ? data.alerts : []

          if (!alertsInitialized.current) {
            incomingAlerts.forEach((item) => {
              if (item.id !== undefined && item.id !== null) {
                seenAlertIds.current.add(String(item.id))
              }
            })
            alertsInitialized.current = true
          } else {
            const newAlerts = incomingAlerts.filter((item) => {
              if (item.id === undefined || item.id === null) return false
              return !seenAlertIds.current.has(String(item.id))
            })

            newAlerts.forEach((item) => {
              seenAlertIds.current.add(String(item.id))

              if ('Notification' in window && Notification.permission === 'granted') {
                showBrowserNotification(
                  `Sentinel Alert · ${item.source || 'Important Update'}`,
                  item.message || 'A meaningful website change was detected.',
                  `sentinel-alert-${item.id}`
                )
              }
            })
          }

          setAlerts(incomingAlerts)
        }
      } catch {
        console.log('Unable to fetch alerts')
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch(`${API}/api/health`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error('Health endpoint unavailable')
        }

        setHealth(data)
        setBackendOnline(true)
      } catch {
        setBackendOnline(false)
      } finally {
        setHealthCheckedAt(new Date())
      }
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 5000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (value) => {
    if (!value) return 'Unavailable'

    if (
      value === 'Just now' ||
      value.includes('ago') ||
      value === 'Pending' ||
      value === 'Unavailable'
    ) {
      return value
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
  }

  const formatUptime = (seconds) => {
    if (typeof seconds !== 'number') return 'Unavailable'

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatMB = (value) => {
    if (typeof value !== 'number') return 'Unavailable'
    return `${Math.round(value).toLocaleString()} MB`
  }

  const checkMonitor = async (monitor) => {
    if (!monitor.url) return

    try {
      const response = await fetch(
        `${API}/api/observe?url=${encodeURIComponent(monitor.url)}`
      )
      const data = await response.json()

      if (!response.ok) {
        setActivity((previous) => [
          {
            source: monitor.name || monitor.url,
            action: data.error || 'Monitor check failed',
            time: new Date().toISOString(),
            status: 'ERROR',
          },
          ...previous,
        ])
        return
      }

      setActivity((previous) => [
        {
          source: data.title || monitor.url,
          action: data.change?.type || 'Checked for updates',
          time: new Date().toISOString(),
          status: data.change?.changed ? 'CHANGE DETECTED' : 'NO CHANGE',
        },
        ...previous,
      ])

      if (data.agent?.important) {
        setAlerts((previous) => [
          {
            id: `local-${Date.now()}`,
            source: data.title || monitor.url,
            url: monitor.url,
            message: data.agent.notification,
            time: new Date().toISOString(),
          },
          ...previous,
        ])

        showBrowserNotification(
          `Sentinel Alert · ${data.title || monitor.url}`,
          data.agent.notification || 'A meaningful website change was detected.',
          `sentinel-local-${Date.now()}`
        )
      }

      setMonitors((previous) =>
        previous.map((item) =>
          item.url === monitor.url
            ? { ...item, lastChecked: 'Just now' }
            : item
        )
      )
    } catch {
      setActivity((previous) => [
        {
          source: monitor.name || monitor.url,
          action: 'Unable to connect to Sentinel backend',
          time: new Date().toISOString(),
          status: 'ERROR',
        },
        ...previous,
      ])
    }
  }

  const addMonitor = async () => {
    const url = monitorUrl.trim()
    if (!url || addingMonitor) return

    const alreadyExists = monitors.some((monitor) => monitor.url === url)

    if (alreadyExists) {
      alert('This website is already being monitored.')
      return
    }

    setAddingMonitor(true)

    try {
      const response = await fetch(
        `${API}/api/observe?url=${encodeURIComponent(url)}`
      )
      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Unable to monitor this website')
        return
      }

      const newMonitor = {
        name: data.title || url,
        url,
        description: 'Monitoring for meaningful updates',
        lastChecked: 'Just now',
      }

      setMonitors((previous) => [...previous, newMonitor])

      setActivity((previous) => [
        {
          source: data.title || url,
          action: data.change?.type || 'Initial observation',
          time: new Date().toISOString(),
          status: data.change?.changed ? 'CHANGE DETECTED' : 'NO CHANGE',
        },
        ...previous,
      ])

      if (data.agent?.important) {
        setAlerts((previous) => [
          {
            id: `local-${Date.now()}`,
            source: data.title || url,
            url,
            message: data.agent.notification,
            time: new Date().toISOString(),
          },
          ...previous,
        ])

        showBrowserNotification(
          `Sentinel Alert · ${data.title || url}`,
          data.agent.notification || 'A meaningful website change was detected.',
          `sentinel-local-${Date.now()}`
        )
      }

      setMonitorUrl('')
      setShowModal(false)
    } catch {
      alert('Unable to connect to Sentinel backend')
    } finally {
      setAddingMonitor(false)
    }
  }

  const removeMonitor = async (monitor) => {
    if (!monitor.url) {
      setMonitors((previous) => previous.filter((item) => item !== monitor))
      return
    }

    const confirmed = window.confirm(
      `Stop watching "${monitor.name || monitor.url}"?`
    )

    if (!confirmed) return

    try {
      const response = await fetch(`${API}/api/monitor`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: monitor.url,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        alert(data.error || 'Unable to remove this monitor.')
        return
      }

      setMonitors((previous) =>
        previous.filter((item) => item.url !== monitor.url)
      )

      setActivity((previous) => [
        {
          source: monitor.name || monitor.url,
          action: 'Stopped monitoring this website',
          time: new Date().toISOString(),
          status: 'REMOVED',
        },
        ...previous,
      ])
    } catch {
      alert('Unable to connect to Sentinel backend.')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setActivePage('Dashboard')
      setShowModal(false)
    } catch (error) {
      console.error('Unable to sign out:', error)
      alert('Unable to sign out. Please try again.')
    }
  }

  const changePage = (page) => {
    setActivePage(page)

    if (window.innerWidth <= 550) {
      setSidebarOpen(false)
    }
  }

  const renderMonitorCards = () => (
    <section className="monitor-grid">
      {monitors.map((monitor, index) => (
        <article className="monitor-card" key={`${monitor.url}-${index}`}>
          <div className="monitor-top">
            <span className="monitor-icon">◎</span>
            <span className="active-badge">ACTIVE</span>
          </div>

          <h3>{monitor.name}</h3>
          <p>{monitor.description}</p>

          <div className="monitor-footer">
            <span>Last checked</span>
            <strong>{monitor.lastChecked}</strong>
          </div>

          {monitor.url ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => checkMonitor(monitor)}
                style={{
                  border: '1px solid rgba(167,139,250,.35)',
                  borderRadius: 10,
                  padding: '11px 14px',
                  background: 'linear-gradient(135deg,rgba(124,58,237,.20),rgba(76,29,149,.10))',
                  color: '#ddd6fe',
                  fontSize: 11,
                  fontWeight: 650,
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04),0 5px 18px rgba(124,58,237,.08)',
                  transition: 'all .2s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = '#8b5cf6'
                  event.currentTarget.style.background = 'linear-gradient(135deg,rgba(124,58,237,.32),rgba(76,29,149,.18))'
                  event.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,.18)'
                  event.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = 'rgba(167,139,250,.35)'
                  event.currentTarget.style.background = 'linear-gradient(135deg,rgba(124,58,237,.20),rgba(76,29,149,.10))'
                  event.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.04),0 5px 18px rgba(124,58,237,.08)'
                  event.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                ↻ &nbsp; CHECK NOW
              </button>

              <button
                onClick={() => removeMonitor(monitor)}
                style={{
                  border: '1px solid rgba(251,113,133,.25)',
                  borderRadius: 10,
                  padding: '11px 14px',
                  background: 'linear-gradient(135deg,rgba(127,29,29,.15),rgba(69,10,10,.08))',
                  color: '#fda4af',
                  fontSize: 11,
                  fontWeight: 650,
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.025)',
                  transition: 'all .2s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = 'rgba(251,113,133,.65)'
                  event.currentTarget.style.background = 'linear-gradient(135deg,rgba(190,24,93,.22),rgba(127,29,29,.14))'
                  event.currentTarget.style.boxShadow = '0 0 18px rgba(244,63,94,.12)'
                  event.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = 'rgba(251,113,133,.25)'
                  event.currentTarget.style.background = 'linear-gradient(135deg,rgba(127,29,29,.15),rgba(69,10,10,.08))'
                  event.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.025)'
                  event.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                × &nbsp; REMOVE
              </button>
            </div>
          ) : (
            <button
              onClick={() => removeMonitor(monitor)}
              style={{
                width: '100%',
                marginTop: 16,
                border: '1px solid rgba(251,113,133,.25)',
                borderRadius: 10,
                padding: '11px 14px',
                background: 'linear-gradient(135deg,rgba(127,29,29,.15),rgba(69,10,10,.08))',
                color: '#fda4af',
                fontSize: 11,
                fontWeight: 650,
                letterSpacing: '.08em',
                cursor: 'pointer',
                transition: 'all .2s ease',
              }}
            >
              × &nbsp; REMOVE
            </button>
          )}
        </article>
      ))}

      <article
        className="monitor-card add-card"
        onClick={() => setShowModal(true)}
      >
        <span className="add-icon">+</span>
        <h3>Add a new monitor</h3>
        <p>Start watching a website or source.</p>
      </article>
    </section>
  )

  const activeMonitors = monitors.filter((monitor) => Boolean(monitor.url)).length
  const changeCount = activity.filter(
    (item) => item.status === 'CHANGE DETECTED'
  ).length
  const noChangeCount = activity.filter(
    (item) => item.status === 'NO CHANGE'
  ).length
  const errorCount = activity.filter((item) => item.status === 'ERROR').length

  const outcomes = [
    { label: 'Changes', value: changeCount, color: '#a78bfa' },
    { label: 'No change', value: noChangeCount, color: '#34d399' },
    { label: 'Errors', value: errorCount, color: '#fb7185' },
  ]

  const maxOutcome = Math.max(1, ...outcomes.map((item) => item.value))

  const sourceCounts = Object.entries(
    alerts.reduce((counts, item) => {
      const source = item.source || 'Unknown source'
      counts[source] = (counts[source] || 0) + 1
      return counts
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const recentActivity = activity.slice(0, 7).reverse()

  const chartPoints = recentActivity.map((item, index) => ({
    x:
      recentActivity.length <= 1
        ? 160
        : 24 + index * (272 / (recentActivity.length - 1)),
    y:
      item.status === 'CHANGE DETECTED'
        ? 24
        : item.status === 'ERROR'
          ? 86
          : 58,
    status: item.status,
  }))

  const linePoints = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  const system = health?.system
  const processInfo = health?.process
  const monitoring = health?.monitoring

  const memoryPercent =
    backendOnline && typeof system?.memoryUsagePercent === 'number'
      ? Math.max(0, Math.min(100, system.memoryUsagePercent))
      : 0

  const panelStyle = {
    background: '#111113',
    border: '1px solid #27272a',
    borderRadius: 16,
    padding: 20,
    minWidth: 0,
  }

  const detailRow = (label, value) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        gap: 16,
        borderTop: '1px solid #242427',
        padding: '12px 0',
        fontSize: 12,
      }}
    >
      <span style={{ color: '#a1a1aa' }}>{label}</span>
      <strong
        style={{
          textAlign: 'right',
          fontWeight: 500,
          maxWidth: '65%',
          overflowWrap: 'anywhere',
        }}
      >
        {value ?? 'Unavailable'}
      </strong>
    </div>
  )

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#08080b',
          color: '#c4b5fd',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '.14em',
          fontSize: 12,
        }}
      >
        SENTINEL // VERIFYING IDENTITY...
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div
      className={`app ${sidebarOpen ? 'sidebar-visible' : 'sidebar-hidden'}`}
    >
      <header className="navbar">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label="Toggle sidebar"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className="logo">
          <span className="logo-mark">◉</span>
          <span>SENTINEL</span>
        </div>

        <div className="navbar-right">
          <div className="nav-status">
            <span
              className="status-dot"
              style={
                backendOnline
                  ? undefined
                  : { background: '#fb7185', boxShadow: '0 0 10px #fb7185' }
              }
            ></span>
            {backendOnline ? 'SYSTEM ONLINE' : 'BACKEND OFFLINE'}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              minWidth: 0,
            }}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: '1px solid #4c3b65',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid #4c3b65',
                  color: '#c4b5fd',
                  background: '#17121f',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </span>
            )}

            <span
              style={{
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#d4d4d8',
                fontSize: 11,
              }}
            >
              {user.displayName || user.email}
            </span>
          </div>

          <button
            className="landing-nav-button"
            onClick={handleLogout}
            style={{
              borderColor: 'rgba(251,113,133,.25)',
              color: '#fda4af',
            }}
          >
            Logout
          </button>

          <button
            className="landing-nav-button"
            onClick={() => setShowLanding(true)}
          >
            ← Landing
          </button>
        </div>
      </header>

      <nav className="sidebar">
        <div className="sidebar-menu">
          {[
            ['Dashboard', '◉'],
            ['Monitors', '◎'],
            ['Activity', '◌'],
            ['Alerts', '!'],
            ['Settings', '⚙'],
          ].map(([page, icon]) => (
            <button
              key={page}
              className={`sidebar-item ${activePage === page ? 'active' : ''}`}
              onClick={() => changePage(page)}
            >
              <span>{icon}</span>
              <span>{page}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div
            style={{
              padding: '12px',
              marginBottom: 8,
              border: '1px solid #29232f',
              borderRadius: 12,
              background: 'rgba(124,58,237,.055)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
            }}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#21172e',
                  color: '#c4b5fd',
                  flexShrink: 0,
                }}
              >
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </span>
            )}

            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.displayName || 'Sentinel User'}
              </strong>
              <small
                style={{
                  display: 'block',
                  color: '#71717a',
                  fontSize: 9,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </small>
            </div>
          </div>

          <button
            className="sidebar-landing"
            onClick={handleLogout}
            style={{ color: '#fda4af' }}
          >
            <span>⇥</span>
            <span>Logout</span>
          </button>

          <button
            className="sidebar-landing"
            onClick={() => setShowLanding(true)}
          >
            <span>←</span>
            <span>Back to Landing</span>
          </button>

          <div className="sidebar-status">
            <span
              className="status-dot"
              style={
                backendOnline
                  ? undefined
                  : { background: '#fb7185', boxShadow: '0 0 10px #fb7185' }
              }
            ></span>
            <div>
              <strong>
                {backendOnline ? 'Sentinel Online' : 'Backend Offline'}
              </strong>
              <small>
                {backendOnline ? 'Monitoring active' : 'Waiting for server'}
              </small>
            </div>
          </div>
        </div>
      </nav>

      <main className="dashboard">
        {activePage === 'Dashboard' && (
          <>
            <section className="hero-section">
              <p className="eyebrow">INTELLIGENT MONITORING SYSTEM</p>
              <h1>
                Good evening, <span>{user.displayName?.split(' ')[0] || 'User'}</span>
              </h1>
              <p className="subtitle">
                Sentinel is actively monitoring your selected sources.
              </p>
            </section>

            <section className="status-card">
              <div className="status-content">
                <p className="card-label">SENTINEL STATUS</p>
                <h2>{backendOnline ? 'Watching' : 'Standby'}</h2>
                <p>
                  {backendOnline
                    ? 'No significant changes detected.'
                    : 'Backend connection is currently unavailable.'}
                </p>
              </div>

              <div className="sentinel-core">
                <div className="core-ring">
                  <div className="core-dot"></div>
                </div>
              </div>
            </section>

            <section className="section-header">
              <div>
                <p className="eyebrow">MONITORING</p>
                <h2>Your Monitors</h2>
              </div>

              <button
                className="add-monitor"
                onClick={() => setShowModal(true)}
              >
                + Add Monitor
              </button>
            </section>

            {renderMonitorCards()}
          </>
        )}

        {activePage === 'Monitors' && (
          <>
            <section className="hero-section">
              <p className="eyebrow">MONITOR MANAGEMENT</p>
              <h1>Your Monitors</h1>
              <p className="subtitle">
                Manage the websites and sources Sentinel watches for changes.
              </p>
            </section>

            <section className="section-header">
              <div>
                <p className="eyebrow">ACTIVE SOURCES</p>
                <h2>Monitored Sources</h2>
              </div>

              <button
                className="add-monitor"
                onClick={() => setShowModal(true)}
              >
                + Add Monitor
              </button>
            </section>

            {renderMonitorCards()}
          </>
        )}

        {activePage === 'Activity' && (
          <>
            <section className="hero-section">
              <p className="eyebrow">SENTINEL ACTIVITY</p>
              <h1>Activity</h1>
              <p className="subtitle">
                A record of checks performed through this browser session.
              </p>
            </section>

            <section className="activity-section">
              {activity.length === 0 ? (
                <div className="activity-item">
                  <div className="activity-icon">◌</div>
                  <div className="activity-info">
                    <h3>No checks recorded yet</h3>
                    <p>Add a monitor or run Check Now to see activity.</p>
                  </div>
                </div>
              ) : (
                activity.map((item, index) => (
                  <div
                    className="activity-item"
                    key={`${item.time}-${index}`}
                  >
                    <div className="activity-icon">◌</div>

                    <div className="activity-info">
                      <h3>{item.source}</h3>
                      <p>{item.action}</p>
                    </div>

                    <div className="activity-right">
                      <span className="activity-status">{item.status}</span>
                      <span className="activity-time">
                        {formatTime(item.time)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}

        {activePage === 'Alerts' && (
          <>
            <section className="hero-section">
              <p className="eyebrow">SENTINEL ALERTS</p>
              <h1>Important Updates</h1>
              <p className="subtitle">
                Updates Sentinel believes may be important to you.
              </p>
            </section>

            <section className="activity-section">
              {alerts.length === 0 ? (
                <div className="activity-item">
                  <div className="activity-icon">✓</div>
                  <div className="activity-info">
                    <h3>No important updates</h3>
                    <p>
                      Sentinel will notify you when it detects something
                      meaningful.
                    </p>
                  </div>
                </div>
              ) : (
                alerts.map((item, index) => (
                  <div
                    className="activity-item"
                    key={item.id || index}
                  >
                    <div className="activity-icon">!</div>

                    <div className="activity-info">
                      <h3>{item.source}</h3>
                      <p>{item.message}</p>

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="monitor-check"
                          style={{
                            display: 'inline-block',
                            marginTop: 10,
                            textDecoration: 'none',
                          }}
                        >
                          Open Website ↗
                        </a>
                      )}
                    </div>

                    <div className="activity-right">
                      <span className="activity-status">IMPORTANT</span>
                      <span className="activity-time">
                        {formatTime(item.time)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}

        {activePage === 'Settings' && (
          <div
            className="settings-dashboard sentinel-command"
            style={{ color: '#f4f4f5' }}
          >
            <style>{`
              .sentinel-command {
                position: relative;
                isolation: isolate;
                overflow: hidden;
                padding: 22px;
                border: 1px solid #29232f;
                border-radius: 22px;
                background:
                  radial-gradient(ellipse at 84% 0%, rgba(124,58,237,.16), transparent 33%),
                  radial-gradient(ellipse at 0% 28%, rgba(190,24,93,.08), transparent 30%),
                  linear-gradient(145deg,#09090c 0%,#0d0b12 48%,#08090d 100%);
                box-shadow:
                  0 0 55px rgba(124,58,237,.07),
                  inset 0 1px 0 rgba(255,255,255,.025);
              }

              .sentinel-command:before {
                content: '';
                position: absolute;
                inset: 0;
                z-index: -1;
                pointer-events: none;
                opacity: .16;
                background-image:
                  linear-gradient(rgba(167,139,250,.10) 1px, transparent 1px),
                  linear-gradient(90deg,rgba(167,139,250,.10) 1px, transparent 1px);
                background-size: 34px 34px;
                mask-image: linear-gradient(to bottom, black, transparent 72%);
              }

              .sentinel-command .hero-section {
                text-align: left;
                padding: 18px 0 24px;
                position: relative;
              }

              .sentinel-command .hero-section h1 {
                letter-spacing: -.055em;
                text-transform: uppercase;
                font-size: clamp(30px,4vw,48px);
                line-height: 1.05;
                text-shadow: 0 0 28px rgba(167,139,250,.17);
              }

              .sentinel-command .eyebrow {
                color: #b7a0ff;
                letter-spacing: .22em;
              }

              .sentinel-command section:not(.hero-section) {
                box-shadow:
                  inset 0 1px 0 rgba(255,255,255,.025),
                  0 12px 35px rgba(0,0,0,.18);
                transition: border-color .2s ease, transform .2s ease;
              }

              .sentinel-command section:not(.hero-section):hover {
                border-color: #51406b !important;
                transform: translateY(-2px);
              }

              .sentinel-command .command-heading {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
                border: 1px solid #31263f;
                background: linear-gradient(
                  90deg,
                  rgba(124,58,237,.11),
                  rgba(12,12,17,.78)
                );
                padding: 15px 17px;
                border-radius: 13px;
                margin-bottom: 20px;
              }

              .sentinel-command .command-chip {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border: 1px solid #3c3150;
                border-radius: 999px;
                background: #15111e;
                padding: 7px 11px;
                color: #d4c7ff;
                font-size: 10px;
                letter-spacing: .13em;
              }

              .sentinel-command .command-light {
                display: inline-block;
                width: 7px;
                height: 7px;
                border-radius: 50%;
              }

              .sentinel-command .stat-card {
                position: relative;
                overflow: hidden;
                background:
                  linear-gradient(
                    145deg,
                    rgba(25,22,33,.96),
                    rgba(12,12,16,.96)
                  ) !important;
                border-color: #332a40 !important;
              }

              .sentinel-command .stat-card:after {
                content: '';
                position: absolute;
                right: -25px;
                bottom: -42px;
                width: 105px;
                height: 105px;
                border: 1px solid rgba(167,139,250,.18);
                border-radius: 50%;
                box-shadow:
                  0 0 0 12px rgba(167,139,250,.025),
                  0 0 0 26px rgba(167,139,250,.02);
                pointer-events: none;
              }

              .sentinel-command .section-title {
                display: flex;
                align-items: center;
                gap: 9px;
              }

              .sentinel-command .section-title:before {
                content: '';
                display: inline-block;
                width: 4px;
                height: 17px;
                border-radius: 4px;
                background: linear-gradient(#c4b5fd,#7c3aed);
                box-shadow: 0 0 12px rgba(167,139,250,.45);
              }

              .sentinel-command .system-warning {
                margin-top: 18px;
                border: 1px solid #4a2939;
                border-radius: 12px;
                background:
                  linear-gradient(
                    90deg,
                    rgba(190,24,93,.10),
                    rgba(20,10,16,.6)
                  );
                padding: 13px 15px;
                display: flex;
                gap: 12px;
                align-items: flex-start;
                color: #d4a9bc;
                font-size: 11px;
                line-height: 1.6;
              }

              @media (max-width: 650px) {
                .sentinel-command {
                  padding: 14px;
                  border-radius: 16px;
                }

                .sentinel-command .hero-section {
                  padding-top: 10px;
                }
              }
            `}</style>

            <div className="command-heading">
              <div>
                <div
                  style={{
                    color: '#a1a1aa',
                    fontSize: 10,
                    letterSpacing: '.2em',
                    marginBottom: 5,
                  }}
                >
                  SNTL // CONTROL PLANE
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 650,
                    letterSpacing: '.04em',
                  }}
                >
                  SYSTEM TELEMETRY
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="command-chip">
                  <span
                    className="command-light"
                    style={{
                      background: backendOnline ? '#34d399' : '#fb7185',
                      boxShadow: backendOnline
                        ? '0 0 12px #34d399'
                        : '0 0 12px #fb7185',
                    }}
                  />
                  {backendOnline ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
                </span>

                <span className="command-chip">◈ LOCAL TELEMETRY</span>
              </div>
            </div>

            <section className="hero-section">
              <p className="eyebrow">SENTINEL SYSTEM CONTROL</p>
              <h1>System Overview</h1>
              <p className="subtitle">
                Live backend health, monitoring insights, activity analytics,
                and configuration details.
              </p>
            </section>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                margin: '0 0 22px',
              }}
            >
              <div style={{ color: '#9ca3af', fontSize: 13 }}>
                SYSTEM SNAPSHOT · Backend refresh every 5 seconds
              </div>

              <div
                style={{
                  border: '1px solid #27272a',
                  background: '#111113',
                  borderRadius: 10,
                  padding: '9px 13px',
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    color: backendOnline ? '#34d399' : '#fb7185',
                  }}
                >
                  ● {backendOnline ? 'LIVE' : 'OFFLINE'}
                </span>
                <span style={{ color: '#a1a1aa', marginLeft: 8 }}>
                  {liveTime.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(175px, 1fr))',
                gap: 14,
                marginBottom: 18,
              }}
            >
              {[
                {
                  label: 'UI MONITORS',
                  value: monitors.length,
                  note: `${activeMonitors} URLs configured in browser`,
                  color: '#a78bfa',
                  icon: '◎',
                },
                {
                  label: 'SAVED ALERTS',
                  value:
                    monitoring?.savedAlerts ??
                    (backendOnline ? alerts.length : '—'),
                  note: 'Backend alert history',
                  color: '#fbbf24',
                  icon: '!',
                },
                {
                  label: 'RECENT CHECKS',
                  value: activity.length,
                  note: 'Checks from this browser session',
                  color: '#60a5fa',
                  icon: '↻',
                },
                {
                  label: 'BACKEND UPTIME',
                  value: backendOnline
                    ? formatUptime(health?.uptimeSeconds)
                    : '—',
                  note: backendOnline
                    ? 'Since server process started'
                    : 'Server not reachable',
                  color: '#34d399',
                  icon: '◷',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="stat-card"
                  style={{
                    background:
                      'linear-gradient(145deg,#151518,#0e0e10)',
                    border: '1px solid #27272a',
                    borderRadius: 16,
                    padding: '19px 20px',
                    minHeight: 118,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      color: '#a1a1aa',
                      fontSize: 10,
                      letterSpacing: 1.2,
                    }}
                  >
                    <span>{stat.label}</span>
                    <span style={{ color: stat.color, fontSize: 18 }}>
                      {stat.icon}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 27,
                      fontWeight: 650,
                      margin: '12px 0 5px',
                      lineHeight: 1.15,
                    }}
                  >
                    {stat.value}
                  </div>

                  <div style={{ color: '#71717a', fontSize: 11 }}>
                    {stat.note}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
                gap: 16,
                marginBottom: 16,
              }}
            >
              <section style={panelStyle}>
                <p className="eyebrow" style={{ marginBottom: 7 }}>
                  HOST INTELLIGENCE
                </p>
                <h2
                  className="section-title"
                  style={{ fontSize: 17, margin: '0 0 16px' }}
                >
                  Machine resources
                </h2>

                {detailRow('Operating system', system?.platform)}
                {detailRow('Architecture', system?.architecture)}
                {detailRow('Hostname', system?.hostname)}
                {detailRow('CPU', system?.cpuModel)}
                {detailRow('Logical CPU cores', system?.cpuCores)}

                <div
                  style={{
                    marginTop: 15,
                    fontSize: 12,
                    color: '#d4d4d8',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 9,
                    }}
                  >
                    <span>System RAM usage</span>
                    <strong>
                      {backendOnline &&
                      typeof system?.memoryUsagePercent === 'number'
                        ? `${system.memoryUsagePercent}%`
                        : 'Unavailable'}
                    </strong>
                  </div>

                  <div
                    style={{
                      height: 9,
                      background: '#27272a',
                      borderRadius: 20,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${memoryPercent}%`,
                        background:
                          memoryPercent >= 85 ? '#fb7185' : '#a78bfa',
                        transition: 'width 250ms ease',
                      }}
                    />
                  </div>

                  <p
                    style={{
                      color: '#a1a1aa',
                      fontSize: 11,
                      marginTop: 9,
                    }}
                  >
                    {formatMB(system?.memoryUsedMB)} used /{' '}
                    {formatMB(system?.memoryTotalMB)} total
                  </p>
                </div>
              </section>

              <section style={panelStyle}>
                <p className="eyebrow" style={{ marginBottom: 7 }}>
                  PROCESS TELEMETRY
                </p>
                <h2
                  className="section-title"
                  style={{ fontSize: 17, margin: '0 0 16px' }}
                >
                  Node.js backend
                </h2>

                {detailRow(
                  'Service status',
                  backendOnline ? 'ONLINE' : 'OFFLINE'
                )}
                {detailRow('Process ID', processInfo?.pid)}
                {detailRow(
                  'Process memory (RSS)',
                  formatMB(processInfo?.memoryUsageMB)
                )}
                {detailRow(
                  'JavaScript heap used',
                  formatMB(processInfo?.heapUsedMB)
                )}
                {detailRow(
                  'JavaScript heap allocated',
                  formatMB(processInfo?.heapTotalMB)
                )}
                {detailRow(
                  'Server uptime',
                  backendOnline
                    ? formatUptime(health?.uptimeSeconds)
                    : 'Unavailable'
                )}
                {detailRow(
                  'Last backend sample',
                  backendOnline
                    ? formatTime(health?.timestamp)
                    : 'Unavailable'
                )}
                {detailRow(
                  'Last connection attempt',
                  healthCheckedAt
                    ? healthCheckedAt.toLocaleTimeString()
                    : 'Pending'
                )}
              </section>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
                gap: 16,
                marginBottom: 16,
              }}
            >
              <section style={panelStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    gap: 12,
                  }}
                >
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 7 }}>
                      ACTIVITY ANALYTICS
                    </p>
                    <h2
                      className="section-title"
                      style={{ fontSize: 17, margin: 0 }}
                    >
                      Recent check outcomes
                    </h2>
                  </div>

                  <span style={{ color: '#71717a', fontSize: 11 }}>
                    Browser session
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 17,
                    marginTop: 24,
                  }}
                >
                  {outcomes.map((item) => (
                    <div key={item.label}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ color: '#d4d4d8' }}>
                          {item.label}
                        </span>
                        <strong>{item.value}</strong>
                      </div>

                      <div
                        style={{
                          height: 8,
                          background: '#27272a',
                          borderRadius: 20,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(item.value / maxOutcome) * 100}%`,
                            background: item.color,
                            borderRadius: 20,
                            transition: 'width 250ms ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p
                  style={{
                    color: '#71717a',
                    fontSize: 11,
                    marginTop: 22,
                    lineHeight: 1.6,
                  }}
                >
                  Only checks initiated in this browser session are counted
                  here. Automatic backend checks are not included.
                </p>
              </section>

              <section style={panelStyle}>
                <p className="eyebrow" style={{ marginBottom: 7 }}>
                  MONITORING TIMELINE
                </p>
                <h2
                  className="section-title"
                  style={{ fontSize: 17, margin: 0 }}
                >
                  Latest recorded checks
                </h2>

                {chartPoints.length > 0 ? (
                  <>
                    <svg
                      viewBox="0 0 320 112"
                      role="img"
                      aria-label="Timeline of the latest recorded monitoring check outcomes"
                      style={{
                        width: '100%',
                        height: 150,
                        marginTop: 10,
                        overflow: 'visible',
                      }}
                    >
                      {[24, 58, 86].map((y) => (
                        <line
                          key={y}
                          x1="18"
                          y1={y}
                          x2="302"
                          y2={y}
                          stroke="#27272a"
                          strokeDasharray="4 5"
                        />
                      ))}

                      {chartPoints.length > 1 && (
                        <polyline
                          points={linePoints}
                          fill="none"
                          stroke="#a78bfa"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      )}

                      {chartPoints.map((point, index) => (
                        <circle
                          key={`${point.x}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r="4.5"
                          fill={
                            point.status === 'CHANGE DETECTED'
                              ? '#a78bfa'
                              : point.status === 'ERROR'
                                ? '#fb7185'
                                : '#34d399'
                          }
                          stroke="#111113"
                          strokeWidth="2"
                        />
                      ))}
                    </svg>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        fontSize: 11,
                        color: '#a1a1aa',
                      }}
                    >
                      <span style={{ color: '#a78bfa' }}>● Change</span>
                      <span style={{ color: '#34d399' }}>● No change</span>
                      <span style={{ color: '#fb7185' }}>● Error</span>
                    </div>

                    <p
                      style={{
                        color: '#71717a',
                        fontSize: 11,
                        marginTop: 15,
                      }}
                    >
                      Vertical positions indicate outcome categories, not a
                      numerical trend.
                    </p>
                  </>
                ) : (
                  <p
                    style={{
                      color: '#a1a1aa',
                      fontSize: 13,
                      marginTop: 24,
                    }}
                  >
                    No checks recorded yet. Add a website and run a check to
                    populate this chart.
                  </p>
                )}
              </section>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
                gap: 16,
                marginBottom: 16,
              }}
            >
              <section style={panelStyle}>
                <p className="eyebrow" style={{ marginBottom: 7 }}>
                  ALERT INTELLIGENCE
                </p>
                <h2
                  className="section-title"
                  style={{ fontSize: 17, margin: '0 0 16px' }}
                >
                  Alerts by source
                </h2>

                {sourceCounts.length > 0 ? (
                  sourceCounts.map(([source, count]) => (
                    <div
                      key={source}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        borderTop: '1px solid #242427',
                        padding: '12px 0',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 3,
                          background: '#a78bfa',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                        }}
                      >
                        {source}
                      </span>
                      <strong style={{ fontSize: 12 }}>{count}</strong>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#a1a1aa', fontSize: 13 }}>
                    No alerts loaded. Important updates will appear here when
                    Sentinel records them.
                  </p>
                )}
              </section>

              <section style={panelStyle}>
                <p className="eyebrow" style={{ marginBottom: 7 }}>
                  CONFIGURATION
                </p>
                <h2
                  className="section-title"
                  style={{ fontSize: 17, margin: '0 0 14px' }}
                >
                  System details
                </h2>

                {detailRow(
                  'Automatic check interval',
                  typeof monitoring?.checkIntervalSeconds === 'number'
                    ? `${monitoring.checkIntervalSeconds} seconds`
                    : 'Unavailable'
                )}
                {detailRow('Health / alert refresh', '5 seconds')}
                {detailRow(
                  'Backend registered URLs',
                  monitoring?.registeredUrls
                )}
                {detailRow(
                  'URLs in current UI',
                  `${activeMonitors} / ${monitors.length} cards`
                )}
                {detailRow('Saved backend alerts', monitoring?.savedAlerts)}
                {detailRow('Backend endpoint', API)}
                {detailRow(
                  'Push notifications',
                  notificationPermission === 'granted' &&
                  localStorage.getItem('sentinel-fcm-token')
                    ? 'FCM ENABLED'
                    : notificationPermission === 'denied'
                      ? 'BLOCKED'
                      : notificationPermission === 'unsupported'
                        ? 'UNSUPPORTED'
                        : 'NOT ENABLED'
                )}
                {detailRow('Signed in as', user.displayName || 'Sentinel User')}
                {detailRow('Account email', user.email)}
                {detailRow('Firebase UID', user.uid)}
                {detailRow('Local clock', liveTime.toLocaleTimeString())}

                {localStorage.getItem('sentinel-fcm-token') ? (
  <button
    className="notification-enable-btn notification-disable-btn"
    onClick={disableNotifications}
  >
    <span className="notification-btn-icon">✓</span>

    <span className="notification-btn-content">
      <span className="notification-btn-title">
        Notifications Active
      </span>

      <span className="notification-btn-subtitle">
        Sentinel is sending important alerts to this device
      </span>
    </span>

    <span className="notification-btn-disable">
      Disable
    </span>
  </button>
) : (
  notificationPermission !== 'denied' && (
    <button
      className="notification-enable-btn"
      onClick={enableNotifications}
    >
      <span className="notification-btn-icon">🔔</span>

      <span className="notification-btn-content">
        <span className="notification-btn-title">
          Enable Notifications
        </span>

        <span className="notification-btn-subtitle">
          Get alerted when Sentinel detects an important change
        </span>
      </span>

      <span className="notification-btn-arrow">→</span>
    </button>
  )
)}

                <p
                  style={{
                    color: '#71717a',
                    fontSize: 11,
                    lineHeight: 1.6,
                    marginBottom: 0,
                  }}
                >
                  Backend monitoring counts and intervals are read from the
                  live health endpoint. Monitor cards are stored locally in this
                  browser and may not match backend registrations.
                </p>
              </section>
            </div>

            <div className="system-warning">
              <span
                style={{
                  color: '#fb7185',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ⚠
              </span>
              <div>
                <strong
                  style={{
                    color: '#fda4af',
                    letterSpacing: '.12em',
                  }}
                >
                  OBSERVABILITY NOTICE
                </strong>
                <br />
                Host and process resource values come from the running Sentinel
                backend. Activity analytics show only events recorded in this
                browser session. These metrics are not evidence of security
                intrusions, network attacks, or threat detection.
              </div>
            </div>
          </div>
        )}
      </main>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">NEW MONITOR</p>
                <h2>Add Monitor</h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <p className="modal-description">
              Tell Sentinel what you want it to watch.
            </p>

            <input
              className="monitor-input"
              type="url"
              placeholder="https://example.com"
              value={monitorUrl}
              onChange={(event) => setMonitorUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addMonitor()
              }}
            />

            <button
              className="monitor-submit"
              disabled={addingMonitor}
              onClick={addMonitor}
            >
              {addingMonitor ? 'Connecting...' : 'Start Monitoring'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
