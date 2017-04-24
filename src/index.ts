interface Ionic {
  handleError: {(error: any): void};
  handleNewError: {(error: any): void};
}

interface IonicHandlerMeta {
  framework: string
}

(function(window: any) {

  const ionic: Ionic = window.Ionic = window.Ionic || {};

  const queue: any[] = [];
  let timerId: any;
  let deviceInfo: any;
  let appId = getAppId();

  let loadEvent = 'load';
  if(window.cordova) {
    loadEvent = 'deviceready';
  }
  window.addEventListener(loadEvent, () => {
    getDeviceInfo().then((info: any) => {
      deviceInfo = info;
    });
  });

  window.TraceKit.remoteFetching = false;

  window.TraceKit.report.subscribe(function(errorReport: any) {
    handleError(errorReport);
  });

  function getAppId() {
    let scripts = document.querySelectorAll('script');
    for(let i = 0; i < scripts.length; i++) {
      let script = scripts[i];
      if(script.src.indexOf('ion-monitor') >= 0) {
        return script.getAttribute('data-app-id');
      }
    }
  }


  function handleError(err: any) {
    err = cleanError(err);
    if (!err) {
      return;
    }
    queue.push(err);

    clearTimeout(timerId);
    timerId = setTimeout(() => {
      drainQueue();
    }, 2000);
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
    let framework = window.angular ? 'angular1' : 'angular2';

    window.fetch('http://localhost:7000/tracking/exceptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        framework: framework,
        device: deviceInfo,
        errors: queue.slice()
      })
    });

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
      var info = {};

      // Try to grab some device info
      var d = window.device;
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

      // Grab app info from the native side
      if(!window.IonicCordovaCommon) {
        return resolve(getBrowserInfo());
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
          window.Ionic.handleNewError(exception, {
            framework: 'angular1'
          });
        };
      }]);
    }]);
  }
})(window);
