interface Ionic {
  handleError: {(error: any): void};
  handleNewError: {(error: any): void};
}

(function(window:any) {

const ionic: Ionic = window.Ionic = window.Ionic || {};

const ourScriptElement = getScriptElement();

const queue: any[] = [];
let timerId: any;
let deviceInfo: any = getBrowserInfo();
let appId = getAppId();
// let devMode = getIsDevMode();
let codeVersion = getProvidedCodeVersion();
let apiUrl = getApiUrl();
let uid = getUid();

console.log('Ionic Error Logging initializing for app', appId);

if(window.cordova) {
  document.addEventListener('deviceready', () => {
    getDeviceInfo().then((info: any) => {
      identify(info);
      deviceInfo = info;
    });
  });
} else {
  window.addEventListener('load', () => {
    getDeviceInfo().then((info: any) => {
      identify(info);
      deviceInfo = info;
    });
  });
}

window.TraceKit.remoteFetching = false;

window.TraceKit.report.subscribe(function(errorReport: any) {
  handleError(errorReport);
});

function postJson(url: string, data: any) {
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open("POST", url);
  xmlhttp.setRequestHeader("Content-Type", "application/json");
  xmlhttp.send(JSON.stringify(data));
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getUid() {
  let uid = window.localStorage.getItem('_iouid')
  if(!uid) {
    uid = uuidv4();
    window.localStorage.setItem('_iouid', uid)
  }
  return uid;
}

function identify(info: any) {
  postJson(`${apiUrl}/monitoring/${appId}/u`, {
    enduser_id: uid,
    os_version: info.osVersion || '',
    device: info.model || '',
    platform: info.platform || info.browserPlatform,
    user_agent: info.browserUserAgent
  });
}

function getScriptElement() {
  let scripts = document.querySelectorAll('script');
  for(let i = 0; i < scripts.length; i++) {
    let script = scripts[i];
    if(script.src.indexOf('ionic-error-tracking') >= 0) {
      return script;
    }
  }
}

function getAppId() {
  const script = ourScriptElement;
  return script && script.getAttribute('data-app-id');
}

function getIsDevMode() {
  const script = ourScriptElement;
  return script && (script.getAttribute('data-dev') === "true")
}

function getProvidedCodeVersion() {
  const script = ourScriptElement;
  return script && script.getAttribute('data-app-version');
}

function getApiUrl() {
  if(getIsDevMode()) {
    return 'http://localhost:7000';
  }
  return 'https://api.ionicjs.com';
}

function handleError(err: any) {
  err = cleanError(err);
  if (!err) {
    return;
  }
  queue.push(err);

  if(!timerId) {
    // If we haven't set a timeout to drain, do it now
    // This means every N seconds we'll do a batch but not ever
    // wait more than N seconds to avoid crazy situations where
    // an exception repeats and we keep delaying the timer
    timerId = setTimeout(() => {
      drainQueue();
    }, 2000);
  }
}

function handleNewError(err: any) {
  window.TraceKit.report(err);
}

function cleanError(err: any) {
  // handle HTTP errors differently
  let newStack = window.TraceKit.computeStackTrace(err);
  err.stack = newStack;

  if(err.url || err.headers) {
    err.isHttp = true;
  }

  err.timestamp = new Date;

  let stack = err.stack;
  for(let frame of stack) {
    frame.context = null;
    delete frame.context;
  }

  return err;
}

function drainQueue() {
  clearTimeout(timerId);
  timerId = null;

  let framework = window.angular ? 'angular1' : 'angular2';

  const payload = {
    app_id: appId,
    framework: framework,
    device: deviceInfo,
    errors: queue.slice()
  }

  console.log('Sending errors to server', payload)

  postJson(`${apiUrl}/monitoring/${appId}/exceptions`, payload);

  queue.length = 0;
}

// Collect browser information
function getBrowserInfo() {
  let n = window.navigator;
  return {
    browserProduct: n.product,
    browserAppVersion: n.appVersion,
    browserUserAgent: n.userAgent,
    browserPlatform: n.platform,
    browserLanguage: n.language,
    browserAppName: n.appName,
    browserAppCodeName: n.appCodeName,
    viewportWidth: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
    viewportHeight: Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
    utcOffset: -(new Date().getTimezoneOffset()/60)
  }
}

// Collect device information, including native device data if available
function getDeviceInfo() {
  return new Promise((resolve, reject) => {
    let info: any = {
      version: codeVersion
    };

    // Try to grab some device info
    let d = window.device;
    if(d) {
      info = {
        model: d.model,
        platform: d.platform,
        uuid: d.uuid,
        osVersion: d.version,
        serial: d.serial,
        manufacturer: d.manufacturer,
        isNative: true
      };
    }

    Object.assign(info, getBrowserInfo());

    // Grab app info from the native side
    if(!window.IonicCordovaCommon) {
      return resolve(info);
    } else {
      console.error('the ionic-cordova-common plugin is not installed. Source Mapping will not work for exceptions. Make sure to install this plugin for full exception reporting')
    }

    window.IonicCordovaCommon.getAppInfo((appInfo: any) => {
      let newInfo = Object.assign(info, appInfo);
      resolve(newInfo);
    }, (err: any) => {
      reject(err);
    });
  });
}

ionic.handleError = handleError;
ionic.handleNewError = handleNewError;

if(window.angular) {

  window.angular.module('ionic')

  .config(['$provide', function($provide: any) {
    $provide.decorator('$exceptionHandler', ['$delegate', function($delegate: any) {
      return function(exception: any, cause: any) {
        $delegate(exception, cause);
        exception.message = exception.stack;
        window.Ionic.handleNewError(exception);
      };
    }]);
  }]);
}

})(window);
