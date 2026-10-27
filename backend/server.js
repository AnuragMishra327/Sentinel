const https = require('https');
const os = require('os');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { diffWords } = require('diff');
const { analyzeChange: analyzeAgent } = require('./agent');

// Firebase Admin SDK
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const firebaseMessaging = getMessaging();
const firebaseAuth = getAuth();

const app = express();
const PORT = process.env.PORT || 5000;

let testVersion = 1;

/* -------------------------------------------------------
   USER-SPECIFIC STATE
------------------------------------------------------- */

const userMonitors = new Map();
const userPushTokens = new Map();

function getUserMonitors(uid) {
  if (!userMonitors.has(uid)) {
    userMonitors.set(uid, new Set());
  }

  return userMonitors.get(uid);
}

function getUserPushTokens(uid) {
  if (!userPushTokens.has(uid)) {
    userPushTokens.set(uid, new Set());
  }

  return userPushTokens.get(uid);
}

const CHECK_INTERVAL = 60 * 1000;
const DEDUPLICATION_WINDOW = 24 * 60 * 60 * 1000;
const MAX_ALERTS = 100;

const memoryFile = path.join(__dirname, 'memory.json');
const alertsFile = path.join(__dirname, 'alerts.json');

app.use(cors());
app.use(express.json());


/* -------------------------------------------------------
   FIREBASE AUTHENTICATION
------------------------------------------------------- */

async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const idToken =
      authHeader.substring(7);

    if (!idToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const decodedToken =
      await firebaseAuth.verifyIdToken(idToken);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null
    };

    next();
  } catch (error) {
    console.error(
      'Authentication failed:',
      error.message
    );

    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token'
    });
  }
}


/* -------------------------------------------------------
   JSON FILE HELPERS
------------------------------------------------------- */

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    const content =
      fs.readFileSync(
        file,
        'utf-8'
      );

    return content.trim()
      ? JSON.parse(content)
      : fallback;
  } catch (error) {
    console.error(
      `Could not read ${path.basename(file)}:`,
      error.message
    );

    return fallback;
  }
}


function writeJsonFile(file, data) {
  try {
    fs.writeFileSync(
      file,
      JSON.stringify(
        data,
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      `Could not write ${path.basename(file)}:`,
      error.message
    );

    throw error;
  }
}


/* -------------------------------------------------------
   LOAD USER-SPECIFIC ALERTS
------------------------------------------------------- */

let userAlerts =
  readJsonFile(
    alertsFile,
    {}
  );

if (
  !userAlerts ||
  typeof userAlerts !== 'object' ||
  Array.isArray(userAlerts)
) {
  userAlerts = {};
}

function getUserAlerts(uid) {
  if (!Array.isArray(userAlerts[uid])) {
    userAlerts[uid] = [];
  }

  return userAlerts[uid];
}


/* -------------------------------------------------------
   RESTORE USER-SPECIFIC MONITORS
------------------------------------------------------- */

const savedMemory =
  readJsonFile(
    memoryFile,
    {}
  );

for (
  const [uid, userMemory]
  of Object.entries(savedMemory)
) {
  if (
    !userMemory ||
    typeof userMemory !== 'object' ||
    Array.isArray(userMemory)
  ) {
    continue;
  }

  const monitoredUrls =
    getUserMonitors(uid);

  for (
    const url
    of Object.keys(userMemory)
  ) {
    monitoredUrls.add(url);
  }
}


/* -------------------------------------------------------
   FIREBASE CLOUD MESSAGING
------------------------------------------------------- */

async function sendPushNotification(uid, alert) {
  const pushTokens =
    getUserPushTokens(uid);

  if (!alert) {
    return;
  }

  if (pushTokens.size === 0) {
    console.log(
      `Push notification skipped for ${uid}: no registered devices.`
    );

    return;
  }

  const tokens =
    Array.from(pushTokens);

  try {
    const response =
      await firebaseMessaging
        .sendEachForMulticast({
          tokens,

          notification: {
            title:
              `Sentinel Alert · ${alert.source}`,

            body:
              alert.message
          },

          data: {
            url:
              alert.url || '',

            alertId:
              String(
                alert.id || ''
              )
          }
        });

    console.log(
      `FCM push for ${uid}: ${response.successCount} sent, ${response.failureCount} failed`
    );

    response.responses.forEach(
      (result, index) => {
        if (result.success) {
          return;
        }

        const errorCode =
          result.error?.code;

        console.error(
          'FCM delivery failed:',
          errorCode ||
          result.error?.message
        );

        if (
          errorCode ===
            'messaging/registration-token-not-registered' ||
          errorCode ===
            'messaging/invalid-registration-token'
        ) {
          pushTokens.delete(
            tokens[index]
          );
        }
      }
    );
  } catch (error) {
    console.error(
      'Unable to send FCM push notification:',
      error.message
    );
  }
}


/* -------------------------------------------------------
   CHANGE DETECTION
------------------------------------------------------- */

function analyzeChange(previous, current) {
  if (!previous) {
    return {
      changed: false,
      type: 'First observation',
      details: []
    };
  }

  if (
    previous.content ===
    current.content
  ) {
    return {
      changed: false,
      type: 'No change',
      details: []
    };
  }

  const differences =
    diffWords(
      previous.content,
      current.content
    );

  const details =
    differences
      .filter(
        part =>
          part.added ||
          part.removed
      )
      .map(part => ({
        type:
          part.added
            ? 'added'
            : 'removed',

        text:
          part.value.trim()
      }))
      .filter(
        part =>
          part.text !== ''
      );

  return {
    changed: true,
    type: 'Content modified',
    details
  };
}


/* -------------------------------------------------------
   WEBSITE OBSERVER
------------------------------------------------------- */

async function observeWebsite(uid, url) {
  let response;

const requestConfig = {
  timeout: 30000,
  maxRedirects: 10,

  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/156.0.0.0 Safari/537.36',

    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',

    'Accept-Language': 'en-US,en;q=0.9',

    'Cache-Control': 'no-cache'
  }
};

try {
  response = await axios.get(url, requestConfig);
} catch (error) {
  const isLegacySslError =
    error.code === 'EPROTO' &&
    String(error.message).includes('unsafe legacy renegotiation');

  if (!isLegacySslError) {
    throw error;
  }

  console.log(`Legacy TLS detected. Retrying: ${url}`);

  const legacyHttpsAgent = new https.Agent({
  secureOptions:
    require('crypto').constants.SSL_OP_LEGACY_SERVER_CONNECT,

  rejectUnauthorized: false
});

  response = await axios.get(url, {
    ...requestConfig,
    httpsAgent: legacyHttpsAgent
  });
}

  const $ =
    cheerio.load(
      response.data
    );

   $(
  [
    'script',
    'style',
    'noscript',
    'svg',
    'canvas',
    'iframe',
    'template',
    'meta',
    'link'
  ].join(',')
).remove();
  const title =
    $('title')
      .text()
      .trim();

  const content =
    $('body')
      .text()
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  const memoryData =
    readJsonFile(
      memoryFile,
      {}
    );

  if (
    !memoryData[uid] ||
    typeof memoryData[uid] !== 'object' ||
    Array.isArray(memoryData[uid])
  ) {
    memoryData[uid] = {};
  }

  if (!memoryData[uid][url]) {
    memoryData[uid][url] = {
      previous: null,
      current: null
    };
  }

  const previousObservation =
    memoryData[uid][url].current;

  const newObservation = {
    url,

    title,

    content,

    lastChecked:
      new Date()
        .toISOString()
  };

  const changeAnalysis =
    analyzeChange(
      previousObservation,
      newObservation
    );

  const agentDecision =
    analyzeAgent({
      ...changeAnalysis,

      previousContent:
        previousObservation
          ?.content || '',

      currentContent:
        newObservation.content
    });

  memoryData[uid][url].previous =
    previousObservation;

  memoryData[uid][url].current =
    newObservation;

  writeJsonFile(
    memoryFile,
    memoryData
  );

  return {
    success: true,

    message:
      'Website observed and analyzed',

    title,

    url,

    lastChecked:
      newObservation.lastChecked,

    change:
      changeAnalysis,

    agent:
      agentDecision
  };
}


/* -------------------------------------------------------
   SAVE USER-SPECIFIC IMPORTANT ALERT
------------------------------------------------------- */

function saveAutomaticAlert(uid, result) {
  const automaticAlerts =
    getUserAlerts(uid);

  const message =
    result.agent?.notification;

  if (
    !message ||
    !result.url
  ) {
    return null;
  }

  const now =
    Date.now();

 const duplicate =
  automaticAlerts.some((alert) => {
    const alertTime =
      new Date(alert.time).getTime();

    return (
      alert.url === result.url &&
      Number.isFinite(alertTime) &&
      now - alertTime >= 0 &&
      now - alertTime < DEDUPLICATION_WINDOW
    );
  });

  if (duplicate) {
    console.log(
      'Duplicate alert suppressed:',
      result.url
    );

    return null;
  }

  const alert = {
    id:
      now,

    source:
      result.title ||
      result.url,

    url:
      result.url,

    message,

    details:
      result.change
        ?.details || [],

    time:
      new Date(now)
        .toISOString()
  };

  automaticAlerts.unshift(
    alert
  );

  userAlerts[uid] =
    automaticAlerts.slice(
      0,
      MAX_ALERTS
    );

  writeJsonFile(
    alertsFile,
    userAlerts
  );

  return alert;
}


/* -------------------------------------------------------
   BACKEND STATUS
------------------------------------------------------- */

app.get(
  '/',
  (req, res) => {
    res.json({
      success: true,

      message:
        'Sentinel backend is running',

      healthEndpoint:
        '/api/health',

      alertsEndpoint:
        '/api/alerts',

      observeEndpoint:
        '/api/observe?url=https://example.com',

      removeMonitorEndpoint:
        '/api/monitor',

      pushTokenEndpoint:
        '/api/push-token'
    });
  }
);


/* -------------------------------------------------------
   HEALTH / SYSTEM TELEMETRY
------------------------------------------------------- */

app.get(
  '/api/health',
  (req, res) => {
    const totalMemory =
      os.totalmem();

    const freeMemory =
      os.freemem();

    const usedMemory =
      totalMemory -
      freeMemory;

    const cpus =
      os.cpus();

    const processMemory =
      process.memoryUsage();

    const registeredUrls =
      Array.from(
        userMonitors.values()
      ).reduce(
        (total, urls) =>
          total + urls.size,
        0
      );

    const savedAlerts =
      Object.values(
        userAlerts
      ).reduce(
        (total, alerts) =>
          total +
          (
            Array.isArray(alerts)
              ? alerts.length
              : 0
          ),
        0
      );

    const registeredPushDevices =
      Array.from(
        userPushTokens.values()
      ).reduce(
        (total, tokens) =>
          total + tokens.size,
        0
      );

    const registeredUsers =
      new Set([
        ...userMonitors.keys(),
        ...userPushTokens.keys(),
        ...Object.keys(userAlerts)
      ]).size;

    res.json({
      success: true,

      status:
        'online',

      uptimeSeconds:
        Math.floor(
          process.uptime()
        ),

      system: {
        platform:
          os.platform(),

        architecture:
          os.arch(),

        hostname:
          os.hostname(),

        cpuCores:
          cpus.length,

        cpuModel:
          cpus[0]?.model ||
          'Unknown',

        memoryTotalMB:
          Math.round(
            totalMemory /
              1024 /
              1024
          ),

        memoryUsedMB:
          Math.round(
            usedMemory /
              1024 /
              1024
          ),

        memoryFreeMB:
          Math.round(
            freeMemory /
              1024 /
              1024
          ),

        memoryUsagePercent:
          Math.round(
            (
              usedMemory /
              totalMemory
            ) * 100
          )
      },

      process: {
        pid:
          process.pid,

        memoryUsageMB:
          Math.round(
            processMemory.rss /
              1024 /
              1024
          ),

        heapUsedMB:
          Math.round(
            processMemory.heapUsed /
              1024 /
              1024
          ),

        heapTotalMB:
          Math.round(
            processMemory.heapTotal /
              1024 /
              1024
          )
      },

      monitoring: {
        registeredUrls,

        savedAlerts,

        registeredPushDevices,

        registeredUsers,

        checkIntervalSeconds:
          CHECK_INTERVAL /
          1000
      },

      timestamp:
        new Date()
          .toISOString()
    });
  }
);


/* -------------------------------------------------------
   REGISTER DEVICE FOR PUSH NOTIFICATIONS
------------------------------------------------------- */

app.post(
  '/api/push-token',
  authenticateUser,
  (req, res) => {
    const pushTokens =
      getUserPushTokens(
        req.user.uid
      );

    const { token } =
      req.body;

    if (
      !token ||
      typeof token !== 'string'
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            'A valid FCM registration token is required'
        });
    }

    const cleanToken =
      token.trim();

    pushTokens.add(
      cleanToken
    );

    console.log(
      `FCM device registered for ${req.user.uid}. User devices: ${pushTokens.size}`
    );

    res.json({
      success: true,

      message:
        'Device registered for Sentinel push notifications',

      registeredDevices:
        pushTokens.size
    });
  }
);


/* -------------------------------------------------------
   REMOVE DEVICE FROM PUSH NOTIFICATIONS
------------------------------------------------------- */

app.delete(
  '/api/push-token',
  authenticateUser,
  (req, res) => {
    const pushTokens =
      getUserPushTokens(
        req.user.uid
      );

    const { token } =
      req.body;

    const removed =
      typeof token === 'string'
        ? pushTokens.delete(
            token.trim()
          )
        : false;

    res.json({
      success: true,

      removed,

      registeredDevices:
        pushTokens.size
    });
  }
);


/* -------------------------------------------------------
   OBSERVE / REGISTER WEBSITE
------------------------------------------------------- */

app.get(
  '/api/observe',
  authenticateUser,
  async (req, res) => {
    const uid =
      req.user.uid;

    const monitoredUrls =
      getUserMonitors(uid);

    const { url } =
      req.query;

    if (
      !url ||
      (
        !url.startsWith(
          'http://'
        ) &&
        !url.startsWith(
          'https://'
        )
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            'A valid HTTP or HTTPS URL is required'
        });
    }

    try {
      monitoredUrls.add(
        url
      );

      const result =
        await observeWebsite(
          uid,
          url
        );

      if (
        result.change.changed &&
        result.agent?.important &&
        result.agent?.notification
      ) {
        const alert =
          saveAutomaticAlert(
            uid,
            result
          );

        if (alert) {
          console.log(
            'IMPORTANT ALERT:',
            alert.message
          );

          await sendPushNotification(
            uid,
            alert
          );
        }
      }

      res.json(
        result
      );
    } catch (error) {
      /*
        If the very first observation fails,
        do not leave a broken monitor registered.
      */
      const memoryData =
        readJsonFile(
          memoryFile,
          {}
        );

      if (!memoryData[uid]?.[url]) {
        monitoredUrls.delete(url);
      }

      console.error(
        'Observation failed:',
        error.message
      );

      res
        .status(500)
        .json({
          success: false,

          error:
            'Unable to observe this website',

          details:
            process.env.NODE_ENV ===
            'development'
              ? error.message
              : undefined
        });
    }
  }
);

/* -------------------------------------------------------
   REMOVE / STOP MONITORING WEBSITE
------------------------------------------------------- */

app.delete(
  '/api/monitor',
  authenticateUser,
  (req, res) => {
    const uid =
      req.user.uid;

    const monitoredUrls =
      getUserMonitors(uid);

    const { url } =
      req.body;

    if (
      !url ||
      (
        !url.startsWith(
          'http://'
        ) &&
        !url.startsWith(
          'https://'
        )
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            'A valid HTTP or HTTPS URL is required'
        });
    }

    /*
      Remove the URL only from
      this user's monitor list.
    */

    const wasMonitored =
      monitoredUrls.delete(
        url
      );

    /*
      Remove only this user's
      observation memory for
      this URL.
    */

    const memoryData =
      readJsonFile(
        memoryFile,
        {}
      );

    const hadMemory =
      Boolean(
        memoryData[uid]?.[url]
      );

    if (hadMemory) {
      delete memoryData[uid][url];

      /*
        If this user has no
        remaining memory entries,
        remove the empty object.
      */

      if (
        Object.keys(
          memoryData[uid]
        ).length === 0
      ) {
        delete memoryData[uid];
      }

      writeJsonFile(
        memoryFile,
        memoryData
      );
    }

    /*
      If the user has no monitors
      remaining, remove their empty
      monitor Set from memory.
    */

    if (
      monitoredUrls.size === 0
    ) {
      userMonitors.delete(uid);
    }

    console.log(
      `Monitor removed for ${uid}:`,
      url
    );

    res.json({
      success: true,

      removed:
        wasMonitored ||
        hadMemory,

      message:
        'Website removed from Sentinel monitoring',

      url,

      registeredUrls:
        monitoredUrls.size
    });
  }
);


/* -------------------------------------------------------
   GET CURRENTLY REGISTERED MONITORS
------------------------------------------------------- */

app.get(
  '/api/monitors',
  authenticateUser,
  (req, res) => {
    const monitoredUrls =
      getUserMonitors(
        req.user.uid
      );

    const urls =
      Array.from(
        monitoredUrls
      );

    res.json({
      success: true,

      count:
        urls.length,

      monitors:
        urls
    });
  }
);


/* -------------------------------------------------------
   RETRIEVE SAVED ALERTS
------------------------------------------------------- */

app.get(
  '/api/alerts',
  authenticateUser,
  (req, res) => {
    const automaticAlerts =
      getUserAlerts(
        req.user.uid
      );

    res.json({
      success: true,

      count:
        automaticAlerts.length,

      alerts:
        automaticAlerts
    });
  }
);


/* -------------------------------------------------------
   AUTOMATIC WEBSITE MONITORING
------------------------------------------------------- */

const monitoringTimer =
  setInterval(
    async () => {

      /*
        Take a snapshot of every
        user's currently monitored
        URLs.

        This prevents iteration
        problems if a user removes
        a monitor while a check is
        already running.
      */

      const userSnapshots =
        Array.from(
          userMonitors.entries()
        ).map(
          ([uid, urls]) => [
            uid,
            Array.from(urls)
          ]
        );

      for (
        const [uid, urls]
        of userSnapshots
      ) {
        const monitoredUrls =
          getUserMonitors(uid);

        for (
          const url
          of urls
        ) {

          /*
            The user may have
            removed this monitor
            after the snapshot
            was created.
          */

          if (
            !monitoredUrls.has(
              url
            )
          ) {
            continue;
          }

          try {
            const result =
              await observeWebsite(
                uid,
                url
              );

            /*
              Check once again
              because the monitor
              may have been removed
              while axios was
              fetching the page.
            */

            if (
              !monitoredUrls.has(
                url
              )
            ) {
              continue;
            }

            if (
              !result.change.changed
            ) {
              console.log(
                `No change for ${uid}:`,
                url
              );

              continue;
            }

            console.log(
              `Change detected for ${uid}:`,
              url
            );

            /*
              Create an alert only
              when the Sentinel
              agent considers the
              change important.
            */

            if (
              result.agent?.important &&
              result.agent?.notification
            ) {
              const alert =
                saveAutomaticAlert(
                  uid,
                  result
                );

              if (alert) {
                console.log(
                  `IMPORTANT ALERT for ${uid}:`,
                  alert.message
                );

                /*
                  Send the notification
                  only to devices belonging
                  to this Firebase user.
                */

                await sendPushNotification(
                  uid,
                  alert
                );
              }
            }
          } catch (error) {
            console.error(
              `Automatic check failed for ${uid}:`,
              url,
              error.message
            );
          }
        }
      }
    },

    CHECK_INTERVAL
  );


/* -------------------------------------------------------
   TEST PAGE
------------------------------------------------------- */

app.get(
  '/test-page',
  (req, res) => {
    const deadline =
      testVersion === 2
        ? '30 September 2026'
        : '20 September 2026';

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sentinel Test Page</title>
        </head>

        <body>
          <h1>Sentinel Test Page</h1>

          <p>
            Application deadline:
            ${deadline}
          </p>
        </body>
      </html>
    `);
  }
);


/* -------------------------------------------------------
   CHANGE TEST PAGE VERSION
------------------------------------------------------- */

app.get(
  '/test-page/set-version',
  (req, res) => {
    const { version } =
      req.query;

    if (
      version !== '1' &&
      version !== '2'
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            'Version must be 1 or 2'
        });
    }

    testVersion =
      Number(
        version
      );

    res.json({
      success: true,

      message:
        `Test page changed to version ${testVersion}`,

      version:
        testVersion
    });
  }
);


/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */

const server =
  app.listen(
    PORT,
    () => {
      const registeredMonitorCount =
        Array.from(
          userMonitors.values()
        ).reduce(
          (total, urls) =>
            total + urls.size,
          0
        );

      const registeredPushDeviceCount =
        Array.from(
          userPushTokens.values()
        ).reduce(
          (total, tokens) =>
            total + tokens.size,
          0
        );

      const registeredUserCount =
        new Set([
          ...userMonitors.keys(),
          ...userPushTokens.keys(),
          ...Object.keys(userAlerts)
        ]).size;

      console.log(
        `Sentinel backend running on http://localhost:${PORT}`
      );

      console.log(
        `Health endpoint: http://localhost:${PORT}/api/health`
      );

      console.log(
        `Registered users: ${registeredUserCount}`
      );

      console.log(
        `Registered monitors: ${registeredMonitorCount}`
      );

      console.log(
        `Registered push devices: ${registeredPushDeviceCount}`
      );

      console.log(
        'Firebase Authentication ready.'
      );

      console.log(
        'Firebase Cloud Messaging ready.'
      );
    }
  );


/* -------------------------------------------------------
   GRACEFUL SHUTDOWN
------------------------------------------------------- */

function shutdown() {
  console.log(
    '\nShutting down Sentinel backend...'
  );

  clearInterval(
    monitoringTimer
  );

  server.close(
    () => {
      console.log(
        'Sentinel backend stopped.'
      );

      process.exit(0);
    }
  );
}


process.on(
  'SIGINT',
  shutdown
);


process.on(
  'SIGTERM',
  shutdown
);