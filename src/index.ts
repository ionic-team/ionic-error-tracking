
(function(window: any){

  const ionic: Ionic = window.Ionic = window.Ionic || {};
  const queue: any[] = [];
  let timerId: any;

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

  function cleanError(err: any) {
    // Ignore HTTP errors
    if (!err || err.url || err.headers) {
      return null;
    }

    return err;
  }

  function drainQueue() {
    const errMsg = JSON.stringify(queue);

    console.error(errMsg);

    queue.length = 0;
  }

  ionic.handleError = handleError;

  window.onerror = function(msg: any, url: any, lineNo: any, columnNo: any, err: any) {
    handleError(err);
  };

})(window);


interface Ionic {
  handleError: {(error: any): void};
}
