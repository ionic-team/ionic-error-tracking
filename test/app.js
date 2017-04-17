console.log("Hello Moto");

function errorOut() {
  throw new Error();
}

function httpError() {
  window.fetch('http://localhost:5999/wut');
}
httpError();
//errorOut();
