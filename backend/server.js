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
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const firebaseMessaging = getMessaging();
const app = express();
const PORT = process.env.PORT || 5000;

let testVersion = 1;

const monitoredUrls = new Set();
const pushTokens = new Set();

const CHECK_INTERVAL = 60 * 1000;
const DEDUPLICATION_WINDOW = 24 * 60 * 60 * 1000;
const MAX_ALERTS = 100;

const memoryFile = path.join(__dirname, 'memory.json');
const alertsFile = path.join(__dirname, 'alerts.json');

app.use(cors());
app.use(express.json());


/* -------------------------------------------------------
   JSON FILE HELPERS
------------------------------------------------------- */

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    const content = fs.readFileSync(
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
   LOAD SAVED ALERTS
------------------------------------------------------- */

let automaticAlerts = readJsonFile(
  alertsFile,
  []
);

if (!Array.isArray(automaticAlerts)) {
  automaticAlerts = [];
}

automaticAlerts =
  automaticAlerts.slice(
    0,
    MAX_ALERTS
  );


/* -------------------------------------------------------
   RESTORE PREVIOUSLY MONITORED URLS
------------------------------------------------------- */

const savedMemory = readJsonFile(
  memoryFile,
  {}
);

for (const url of Object.keys(savedMemory)) {
  monitoredUrls.add(url);
}


/* -------------------------------------------------------
   FIREBASE CLOUD MESSAGING
------------------------------------------------------- */

async function sendPushNotification(alert) {
  if (!alert) {
    return;
  }

  if (pushTokens.size === 0) {
    console.log(
      'Push notification skipped: no registered devices.'
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
      `FCM push result: ${response.successCount} sent, ${response.failureCount} failed`
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

        /*
          Remove invalid or expired
          registration tokens.
        */

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

async function observeWebsite(url) {
  const response =
    await axios.get(
      url,
      {
        timeout: 10000,

        headers: {
          'User-Agent':
            'Sentinel Monitoring System'
        }
      }
    );

  const $ =
    cheerio.load(
      response.data
    );

  $('script, style, noscript')
    .remove();

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

  if (!memoryData[url]) {
    memoryData[url] = {
      previous: null,
      current: null
    };
  }

  const previousObservation =
    memoryData[url].current;

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

  memoryData[url].previous =
    previousObservation;

  memoryData[url].current =
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
   SAVE IMPORTANT ALERT
------------------------------------------------------- */

function saveAutomaticAlert(result) {
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
    automaticAlerts.some(
      alert => {

        const alertTime =
          new Date(
            alert.time
          ).getTime();

        return (
          alert.url ===
            result.url &&

          alert.message ===
            message &&

          Number.isFinite(
            alertTime
          ) &&

          now - alertTime >= 0 &&

          now - alertTime <
            DEDUPLICATION_WINDOW
        );
      }
    );

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

  automaticAlerts =
    automaticAlerts.slice(
      0,
      MAX_ALERTS
    );

  writeJsonFile(
    alertsFile,
    automaticAlerts
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
        registeredUrls:
          monitoredUrls.size,

        savedAlerts:
          automaticAlerts.length,

        registeredPushDevices:
          pushTokens.size,

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
  (req, res) => {

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
      `FCM device registered. Total devices: ${pushTokens.size}`
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
  (req, res) => {

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
  async (req, res) => {

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
      /*
        Register website for
        automatic monitoring.
      */

      monitoredUrls.add(
        url
      );

      const result =
        await observeWebsite(
          url
        );

      if (
        result.change.changed &&
        result.agent?.important &&
        result.agent?.notification
      ) {
        const alert =
          saveAutomaticAlert(
            result
          );

        if (alert) {
          console.log(
            'IMPORTANT ALERT:',
            alert.message
          );

          await sendPushNotification(
            alert
          );
        }
      }

      res.json(
        result
      );
    } catch (error) {
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
  (req, res) => {

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
      Remove URL from automatic
      monitoring.
    */

    const wasMonitored =
      monitoredUrls.delete(
        url
      );

    /*
      Remove observation memory
      so Sentinel completely
      forgets this monitor.
    */

    const memoryData =
      readJsonFile(
        memoryFile,
        {}
      );

    const hadMemory =
      Boolean(
        memoryData[url]
      );

    if (hadMemory) {
      delete memoryData[url];

      writeJsonFile(
        memoryFile,
        memoryData
      );
    }

    console.log(
      'Monitor removed:',
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
  (req, res) => {

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
  (req, res) => {

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
        Create an array snapshot.
        This prevents problems if
        a monitor is removed while
        the loop is running.
      */

      const urls =
        Array.from(
          monitoredUrls
        );

      for (
        const url of urls
      ) {

        /*
          If the monitor was
          removed after the
          snapshot was created,
          skip it.
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
              url
            );

          /*
            Check again in case
            the monitor was removed
            while the HTTP request
            was running.
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
              'No change:',
              url
            );

            continue;
          }

          console.log(
            'Change detected:',
            url
          );

          if (
            result.agent?.important &&
            result.agent?.notification
          ) {
            const alert =
              saveAutomaticAlert(
                result
              );

            if (alert) {
              console.log(
                'IMPORTANT ALERT:',
                alert.message
              );

              await sendPushNotification(
                alert
              );
            }
          }
        } catch (error) {
          console.error(
            'Automatic check failed:',
            url,
            error.message
          );
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

      console.log(
        `Sentinel backend running on http://localhost:${PORT}`
      );

      console.log(
        `Health endpoint: http://localhost:${PORT}/api/health`
      );

      console.log(
        `Registered monitors: ${monitoredUrls.size}`
      );

      console.log(
        `Registered push devices: ${pushTokens.size}`
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