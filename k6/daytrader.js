import http from 'k6/http';
import { fail, group } from 'k6'
import { sleep } from 'k6';
import { check } from 'k6';
import { Trend } from 'k6/metrics'
import ws from 'k6/ws';

import exec from 'k6/execution';

import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { URL } from 'https://jslib.k6.io/url/1.0.0/index.js';



export const options = {
  // A number specifying the number of VUs to run concurrently.
  vus: 1,
  // A string specifying the total duration of the test run.
  duration: '60s',
  // iterations: 500,

  // The following section contains configuration options for execution of this
  // test script in Grafana Cloud.
  //
  // See https://grafana.com/docs/grafana-cloud/k6/get-started/run-cloud-tests-from-the-cli/
  // to learn about authoring and running k6 test scripts in Grafana k6 Cloud.
  //
  // cloud: {
  //   // The ID of the project to which the test is assigned in the k6 Cloud UI.
  //   // By default tests are executed in default project.
  //   projectID: "",
  //   // The name of the test in the k6 Cloud UI.
  //   // Test runs with the same name will be grouped.
  //   name: "daytrader.js"
  // },

  // Uncomment this section to enable the use of Browser API in your tests.
  //
  // See https://grafana.com/docs/k6/latest/using-k6-browser/running-browser-tests/ to learn more
  // about using Browser API in your test scripts.
  //
  // scenarios: {
  //   // The scenario name appears in the result summary, tags, and so on.
  //   // You can give the scenario any name, as long as each name in the script is unique.
  //   ui: {
  //     // Executor is a mandatory parameter for browser-based tests.
  //     // Shared iterations in this case tells k6 to reuse VUs to execute iterations.
  //     //
  //     // See https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ for other executor types.
  //     executor: 'shared-iterations',
  //     options: {
  //       browser: {
  //         // This is a mandatory parameter that instructs k6 to launch and
  //         // connect to a chromium-based browser, and use it to run UI-based
  //         // tests.
  //         type: 'chromium',
  //       },
  //     },
  //   },
  // }
};

const trend = new Trend('thinking_time');
const wdist = new Trend('weibull');


// Weibull Distribution Function 
// https://en.wikipedia.org/wiki/Weibull_distribution
//
// x: small values are events occurring early, larger are events occuring later
// lambda: If you know that events typically occur around a certain value, set 𝜆 close to that value.
// k: 
//  k < 1: failure rate decreases over time (early-life failures)
//  k = 1: constant failure rate over time (memoryless processes)
//  k > 1: failure rate increases over time (wear-out failures)
//
// retures the likelyhood of x given lamda and k
function weibullPDF(x, lambda, k) {
  if (x < 0) {
      return 0;
  }
  return (k / lambda) * Math.pow((x / lambda), (k - 1)) * Math.exp(-Math.pow((x / lambda), k));
}


// Random number generation using Weibull distribution
// https://www.taygeta.com/random/weibull.html
//
// refer to weibullPDF (abover) for lambda and k explanation
function weibullRandom(lambda, k) { 
  const w = lambda * Math.pow(-Math.log(1 - Math.random()), 1 / k);
  wdist.add(w) 
  return w
}

// According Nielsing Norman Group and Microsoft research
// a typical user spent 10-20s in a page, and the time spent
// follow weibull_distribution. According to Nielson's  plot
// https://media.nngroup.com/media/editor/alertbox/weibull-hazard-function-leaving-web-pages.png
// and comparing with the parameters from weibull distribution
// from wikipedia (see above), we consider lambda=0.5 (g)
//
//  refs:
//  1. https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/
//  2. https://dl.acm.org/doi/abs/10.1145/1835449.1835513
function thinking_time(maxthinkingtime) {
  const time = weibullRandom(maxthinkingtime, 1)
  trend.add(time);
  return time
}

const USER_AGENT = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.2; SV1; .NET CLR 1.1.4322)';
const ACCEPT = 'image/gif, image/x-xbitmap, image/jpeg, image/pjpeg, */*';
const ACCEPT_LANGUAGE = 'en-us';

const minimumuid = parseInt(__ENV.BOTUID || '0');
const maximumuid = parseInt(__ENV.TOPUID || '14999');
const hostname = __ENV.HOST || 'localhost';
const port = __ENV.PORT || '9080';
const maxthinkingtime = __ENV.MAXTHINKTIME || '0';
const maximumsid = parseInt(__ENV.STOCKS || '9999');
const protocol = __ENV.PROTOCOL || 'http';

const baseURL = `${protocol}://${hostname}:${port}`;

const jsfViewRegex = /<input type="hidden" name="javax\.faces\.ViewState" id="j_id__v_0:javax\.faces\.ViewState:1" value="([^"]+)".*\/>/;

// https://community.grafana.com/t/share-writable-or-mutable-data-between-iterations-in-a-vu/105699
// logingCounter must increment or reset when reacking maximumuid (minimumuid + (loginCounter + 1) % maximumuid)
let loginCounter = 0;

// default = 10% of executions
function jsf_controller(loginCounter) {
  let loop = false;
  let jsfState = '';

  const jsfViewState = (r) => {
    const match = r.body.match(jsfViewRegex);
    if (match) {
      return match[1];
    }
    return '';
  }

  group('welcome jsf', function () {
    const res = http.post(`${baseURL}/daytrader/welcome.faces`);
    check(res, { 'status was 200': (r) => r.status === 200 });
    jsfState = jsfViewState(res);
  })



  // login jsf
  group('login jsf', function () {
    const loginURL = new URL(`${baseURL}/daytrader/welcome.faces`);

    loginURL.searchParams.append('javax.faces.ViewState', jsfState);
    loginURL.searchParams.append('login:password', 'xxx');
    loginURL.searchParams.append('login:submit', 'Log in',);
    loginURL.searchParams.append('login:uid', `uid:${loginCounter}`);
    loginURL.searchParams.append('login_SUBMIT', '1');

    let res = http.post(loginURL.toString());
    const readyToTrade = res.body.includes('Ready to Trade')

    check(res, {
      'status was 200': (r) => r.status === 200,
      'ready to trade': (r) => r.body.includes('Ready to Trade'),
      'exceptions': (r) => !r.body.includes('Exception')
    });

    sleep(thinking_time(maxthinkingtime))

    loop = readyToTrade
  })



  // // default = 36% of executions
  const quotes = () => {
    let toBuy = 0;

    group('quotes jsf', function () {
      // let quoteURL = `${baseURL}/daytrader/quote.faces`
      const quoteURL = new URL(`${baseURL}/daytrader/quote.faces`);
      let res = http.get(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });

      quoteURL.searchParams.append('javax.faces.ViewState', jsfViewState(res));
      quoteURL.searchParams.append('quotes:symbols', `s:${randomIntBetween(0, maximumsid)}`);
      quoteURL.searchParams.append('quotes:submit2', 'quotes');
      quoteURL.searchParams.append('quotes_SUBMIT', '1',);
      quoteURL.searchParams.append('quotes:quotes:0:quantity', '100',);
      quoteURL.searchParams.append('quotes:quotes:0:quantity', '100',);
      quoteURL.searchParams.append('quotes:quotes:0:quantity', '100',);
      quoteURL.searchParams.append('quotes:quotes:0:quantity', '100',);
      quoteURL.searchParams.append('quotes:quotes:0:quantity', '100',);

      res = http.post(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'daytrader quotes': res.body.includes('DayTrader Quotes'),
      });

      toBuy = ((b) => {
        const match = b.match(/s:([0-9]+)/);
        if (match) {
          return match[1];
        }
        return 0;
      })(res.body);

      sleep(thinking_time(maxthinkingtime));
    });

    return toBuy;
  };

  // default = 16% of executions
  const home = () => {
    group('home jsf', function () {
      const res = http.get(`${baseURL}/daytrader/tradehome.faces`)
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });
      jsfState = jsfViewState(res);
      sleep(thinking_time(maxthinkingtime));
    });
  }

  // default = 15% of executions
  const portfolio = () => {
    let holdings = 0
    group('portfolio jsf', function () {
      const res = http.get(`${baseURL}/daytrader/portfolio.faces`)
      check(res, { 'status was 200': (r) => r.status === 200 });

      holdings = ((b) => {
        const match = b.match(/of Holdings: <\/b>([1-9][0-9]*)<\/td>/);
        if (match) {
          return match[1];
        }
        return 0;
      })(res.body);
      jsfState = jsfViewState(res);
      sleep(thinking_time(maxthinkingtime));
    });

    return holdings;
  }

  // default = 10% of executions
  const account = () => {
    let jsfState = ''
    group('account jsf', function () {
      const res = http.get(`${baseURL}/daytrader/account.faces`)
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });
      sleep(thinking_time(maxthinkingtime));
      jsfState = jsfViewState(res);
    });
    return jsfState

  }

  // // default = 8%
  const marketSummary = () => {
    group('market summary', function () {
      // websocket
      let url = ''
      if (protocol == 'http') {
        url = `ws://${hostname}:${port}/daytrader/marketsummary`;
      }
      else if (protocol == 'https') {
        url = `wss://${hostname}:${port}/daytrader/marketsummary`;
      } else {
        fail(`protocl not supported`)
      }

      const params = { headers: { 'User-Agent': USER_AGENT, 'Accept': ACCEPT, 'Accept-Language': ACCEPT_LANGUAGE } };
      const res = ws.connect(url, params, function (socket) {

        socket.on('open', function () {
          socket.send(JSON.stringify({ action: 'updateMarketSummary' }));
        });

        socket.on('message', function (message) {
          check(message, { 'message received': (m) => m != "{}" })
          socket.close()
        });

        socket.on('close', function () {
        });

        socket.setTimeout(function () {
          socket.close();
        }, 20000); // 20 seconds timeout 

      });
      check(res, {
        ' status is 101': (r) => r && r.status === 101,
        'exceptions': (r) => !r.body.includes('Exception')
      })
      // Constant Timer equivalent 
      sleep(thinking_time(maxthinkingtime));
    });
  }

  // default = 4% of executions
  const buy = () => {
    group('buy jsf', function () {
      const toBuy = quotes();

      const quoteURL = new URL(`${baseURL}/daytrader/quote.faces`);
      let res = http.get(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });

      quoteURL.searchParams.append('javax.faces.ViewState', jsfViewState(res));
      quoteURL.searchParams.append('quotes:symbols', `s:${toBuy}`);
      quoteURL.searchParams.append('quotes_SUBMIT', '1',);
      quoteURL.searchParams.append('quotes:quotes:0:quantity', `${randomIntBetween(1, 200)}`);
      quoteURL.searchParams.append('quotes:quotes:0:buy', '100',);

      res = http.post(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'been submitted': (r) => r.body.includes('been submitted'),
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime));

    });
  }

  // // default = 4% of executions
  const sell = () => {
    group('sell jsf', function () {
      const holdings = portfolio();
      if (holdings == 0) {
        return;
      }
      const quoteURL = new URL(`${baseURL}/daytrader/portfolio.faces`);
      // let res = http.get(quoteURL.toString())
      // check(res, { 'status was 200': (r) => r.status === 200 });

      quoteURL.searchParams.append('javax.faces.ViewState', jsfState);
      quoteURL.searchParams.append('portfolio:symbols', 's:0,s:1,s:2,s:3,s:4');
      quoteURL.searchParams.append('portfolio_SUBMIT', '1',);
      quoteURL.searchParams.append('portfolio:_idcl', 'portfolio:holdings:0:sell');

      const res = http.post(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'been submitted': (r) => r.body.includes('been submitted'),
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime));
    })
  }

  // default = 2% of executions
  const update = () => {
    group('update jsf', function () {
      jsfState = account()

      const params = new URLSearchParams({
        'javax.faces.ViewState': jsfState,
        'updateProfile:uid': `uid:${loginCounter}`,
        'updateProfile:fullname': `rnd${exec.vu.idInInstance}${loginCounter}`,
        'updateProfile:password': 'xxx',
        'updateProfile:address': 'rndAddress',
        'updateProfile:cpassword': 'xxx',
        'updateProfile:ccn': 'rndCC',
        'updateProfile:email': 'rndEmail@email.com',
        'updateProfile_SUBMIT': '1',
        'updateProfile:submit': 'Update Profile',
        'updateProfile:symbols': 's:0,s:1,s:2,s:3,s:4',
      }).toString();

      const res = http.post(`${baseURL}/daytrader/account.faces?${params}`)
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime));
    })
  }

  // default = 1% of executions
  const register = () => {
    logout()
    group('register jsf', function () {
      let res = http.get(`${baseURL}/daytrader/register.faces`)
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });
      const params = new URLSearchParams({
        'javax.faces.ViewState': jsfViewState(res),
        'register:fullname': `first:${Math.floor(Math.random() * 1000)} last:${Math.floor(Math.random() * 5000)}`,
        'register:address': `first:${Math.floor(Math.random() * 1000)} last:${Math.floor(Math.random() * 5000)}`,
        'register:email': `uid${loginCounter}@${Math.floor(Math.random() * 101)}.com`,
        'register:uid': `ru:${loginCounter}${exec.vu.idInInstance}:${new Date().toLocaleTimeString()}${Math.floor(Math.random() * 1000)}`,
        'register:password': 'yyy',
        'register:cpassword': 'yyy',
        'register:money': '1000000',
        'register:ccn': '123-fake-ccnum-456',
        'register_SUBMIT': '1',
        'register:submit': 'Register',
      }).toString();

      res = http.post(`${baseURL}/daytrader/register.faces?${params}`)
      check(res, {
        'status was 200': (r) => r.status === 200,
        'registration operation succeeded': (r) => r.body.includes("Registration operation succeeded"),
        'exceptions': (r) => !r.body.includes('Exception'),
      });
      sleep(thinking_time(maxthinkingtime))
    })

    logout()

  }

  // default = 4% of executions
  const logout = () => {
    group('logout jsf', function () {
      home()

      const tradeHomeURL = new URL(`${baseURL}/daytrader/tradehome.faces`);

      tradeHomeURL.searchParams.append('javax.faces.ViewState', jsfState);
      tradeHomeURL.searchParams.append('tradeHome:_idcl', 'tradeHome:logoff');
      tradeHomeURL.searchParams.append('tradeHome:symbols', 's:0,s:1,s:2,s:3,s:4');
      tradeHomeURL.searchParams.append('tradeHome_SUBMIT', '1');

      const res = http.post(tradeHomeURL.toString());
      check(res, {
        'status was 200': (r) => r.status === 200,
        'daytrader login': (r) => r.body.includes("DayTrader Login"),
        'exceptions': (r) => !r.body.includes('Exception'),
      });
      sleep(thinking_time(maxthinkingtime));
      loop = false;
    })
  }

  const actions = [quotes, home, portfolio, account, marketSummary, buy, sell, update, register, logout];
  const probabilities = [
    { action: 0, max: 36 }, // quotes 
    { action: 1, max: 52 }, // home 
    { action: 2, max: 67 }, // portfolio 
    { action: 3, max: 77 }, // account 
    { action: 4, max: 85 }, // marketSummary 
    { action: 5, max: 89 }, // buy 
    { action: 6, max: 93 }, // sell 
    { action: 7, max: 95 }, // update 
    { action: 8, max: 96 }, // register 
    { action: 9, max: 100 } // logout 
  ];

  while (loop) {
    const draw = randomIntBetween(1, 100);
    const action = probabilities.find(p => draw <= p.max).action;
    actions[action]();

  }
}

// default = 70% of executions
function jsp_controller(loginCounter) {
  let loop = false;

  // login jsp
  group('login jsp', function () {
    const loginURL = new URL(`${baseURL}/daytrader/app`);
    loginURL.searchParams.append('passwd', 'xxx');
    loginURL.searchParams.append('uid', `uid:${loginCounter}`);
    loginURL.searchParams.append('action', 'login');

    let res = http.post(loginURL.toString());
    const readyToTrade = res.body.includes('Welcome to DayTrader')

    check(res, {
      'status was 200': (r) => r.status === 200,
      'ready to trade': res.body.includes('Welcome to DayTrader'),
      'exceptions': (r) => !r.body.includes('Exception'),
      'logged': readyToTrade,
    });

    sleep(thinking_time(maxthinkingtime))

    loop = readyToTrade
  })


  // // default = 36% of executions
  const quotes = () => {
    let toBuy = 0;

    group('quotes jsp', function () {
      // let quoteURL = `${baseURL}/daytrader/quote.faces`
      const quoteURL = new URL(`${baseURL}/daytrader/app`);
      quoteURL.searchParams.append('action', 'quotes');
      quoteURL.searchParams.append('symbols', `s:${randomIntBetween(0, maximumsid)}`);
      let res = http.get(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'daytrader quotes': res.body.includes('DayTrader: Quotes and Trading'),
        'exceptions': (r) => !r.body.includes('Exception')
      });

      toBuy = ((b) => {
        const match = b.match(/s:([0-9]+)/);
        if (match) {
          return match[1];
        }
        return 0;
      })(res.body);

      sleep(thinking_time(maxthinkingtime));
    });

    return toBuy;
  };

  // default = 16% of executions
  const home = () => {
    group('home jsp', function () {

      const url = new URL(`${baseURL}/daytrader/app`);
      url.searchParams.append('action', 'home');
      const res = http.get(url.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });
      sleep(thinking_time(maxthinkingtime));
    });
  }

  // default = 15% of executions
  const portfolio = () => {
    let holdings = 0
    group('portfolio jsp', function () {
      const url = new URL(`${baseURL}/daytrader/app`);
      url.searchParams.append('action', 'portfolio');
      const res = http.get(url.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });

      holdings = ((b) => {
        const match = b.match(/holdingID=([0-9]+)/);
        if (match) {
          return match[1];
        }
        return 0;
      })(res.body);
      sleep(thinking_time(maxthinkingtime));
    });

    return holdings;
  }

  // default = 10% of executions
  const account = () => {
    group('account jsp', function () {
      const url = new URL(`${baseURL}/daytrader/app`);
      url.searchParams.append('action', 'account');
      const res = http.get(url.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });
      sleep(thinking_time(maxthinkingtime));
    });
  }

  // // default = 8%
  const marketSummary = () => {
    group('market summary jsp', function () {
      // websocket
      let url = ''
      if (protocol == 'http') {
        url = `ws://${hostname}:${port}/daytrader/marketsummary`;
      }
      else if (protocol == 'https') {
        url = `wss://${hostname}:${port}/daytrader/marketsummary`;
      } else {
        fail(`protocl not supported`)
      }

      const params = { headers: { 'User-Agent': USER_AGENT, 'Accept': ACCEPT, 'Accept-Language': ACCEPT_LANGUAGE } };
      const res = ws.connect(url, params, function (socket) {

        socket.on('open', function () {
          socket.send(JSON.stringify({ action: 'updateMarketSummary' }));
        });

        socket.on('message', function (message) {
          check(message, { 'message received': (m) => m != "{}" })
          socket.close()
        });

        socket.on('close', function () {
        });

        socket.setTimeout(function () {
          socket.close();
        }, 20000); // 20 seconds timeout 

      });

      check(res, {
        'status is 101': (r) => r && r.status === 101,
        'exceptions': (r) => !r.body.includes('Exception')
      })
      // Constant Timer equivalent 
      sleep(thinking_time(maxthinkingtime));
    });
  }

  // default = 4% of executions
  const buy = () => {
    group('buy jsp', function () {
      const toBuy = quotes();

      const quoteURL = new URL(`${baseURL}/daytrader/app`);
      quoteURL.searchParams.append('action', 'buy');
      quoteURL.searchParams.append('symbol', `s:${toBuy}`);
      quoteURL.searchParams.append('quantity', `${randomIntBetween(1, 200)}`);

      const res = http.get(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'has been submitted': (r) => r.body.includes('has been submitted'),
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime));

    });
  }

  // // default = 4% of executions
  const sell = () => { // TODO
    group(' sell jsp', function () {
      const holdings = portfolio();
      if (holdings == 0) {
        return;
      }
      const quoteURL = new URL(`${baseURL}/daytrader/app`);
      // let res = http.get(quoteURL.toString())
      // check(res, { 'status was 200': (r) => r.status === 200 });

      quoteURL.searchParams.append('action', 'sell');
      quoteURL.searchParams.append('holdingID', holdings);

      const res = http.get(quoteURL.toString())
      check(res, {
        'status was 200': (r) => r.status === 200,
        'has been submitted': (r) => r.body.includes('has been submitted'),
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime));
    })
  }

  // default = 2% of executions
  const update = () => {
    group('update jsp', function () {
      account()

      const params = new URLSearchParams({
        'userID': `uid:${loginCounter}`,
        'fullname': `rnd${exec.vu.idInInstance}${loginCounter}`,
        'password': 'xxx',
        'address': 'rndAddress',
        'cpassword': 'xxx',
        'creditcard': 'rndCC',
        'email': 'rndEmail@email.com',
        'action': 'update_profile',
      }).toString();

      const res = http.get(`${baseURL}/daytrader/app?${params}`)
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime));
    })

  }

  // default = 1% of executions
  const register = () => {

    group('register', function () {
      logout()

      let res = http.get(`${baseURL}/daytrader/register.jsp`)
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime))

      res = http.get(`${baseURL}/daytrader/register.jsp`)
      check(res, { 'status was 200': (r) => r.status === 200 });
      const params = new URLSearchParams(
        {
          'action': 'register',
          'Full Name': `first:${Math.floor(Math.random() * 1000)} last:${Math.floor(Math.random() * 5000)}`,
          'snail mail': `first:${Math.floor(Math.random() * 1000)} last:${Math.floor(Math.random() * 5000)}`,
          'email': `uid${loginCounter}@${Math.floor(Math.random() * 101)}.com`,
          'user id': `ru:${loginCounter}${exec.vu.idInInstance}:${new Date().toISOString().split('T')[1].replace(/[:.]/g, '')}${Math.floor(Math.random() * 1000)}`,
          'passwd': 'yyy',
          'confirm passwd': 'yyy',
          'money': '1000000',
          'Credit Card Number': '123-fake-ccnum-456',
        }
      );

      res = http.get(`${baseURL}/daytrader/register.faces?${params}`)
      sleep(thinking_time(maxthinkingtime))
      check(res, {
        'status was 200': (r) => r.status === 200,
        'exceptions': (r) => !r.body.includes('Exception')
      });

      logout()
      sleep(thinking_time(maxthinkingtime))
    })

  }

  // default = 4% of executions
  const logout = () => {
    group('logout jsp', function () {
      const url = new URL(`${baseURL}/daytrader/app`);

      url.searchParams.append('action', 'logout');

      const res = http.get(url.toString());
      check(res, {
        'status was 200': (r) => r.status === 200,
        'daytrader login': (r) => r.body.includes("DayTrader Login"),
        'exceptions': (r) => !r.body.includes('Exception')
      });

      sleep(thinking_time(maxthinkingtime));
      loop = false;
    })
  }

  const actions = [quotes, home, portfolio, account, marketSummary, buy, sell, update, register, logout];
  const probabilities = [
    { action: 0, max: 36 }, // quotes 
    { action: 1, max: 52 }, // home 
    { action: 2, max: 67 }, // portfolio 
    { action: 3, max: 77 }, // account 
    { action: 4, max: 85 }, // marketSummary 
    { action: 5, max: 89 }, // buy 
    { action: 6, max: 93 }, // sell 
    { action: 7, max: 95 }, // update 
    { action: 8, max: 96 }, // register 
    { action: 9, max: 100 } // logout 
  ];

  while (loop) {
    const draw = randomIntBetween(1, 100);
    const action = probabilities.find(p => draw <= p.max).action;
    actions[action]();
  }
}


// default = 20% of executions
function jax_controller(logingCounter) {
  group('quotes jax-rs', function () {
    const url = new URL(`${baseURL}/daytrader/rest/quotes`);
    url.searchParams.append('symbols', `s:${randomIntBetween(1, maximumsid)}`);

    const res = http.post(url.toString())
    check(res, {
      'status was 200': (r) => r.status === 200,
    })
    sleep(thinking_time(maxthinkingtime))
  })

}

const actions = [jsf_controller, jsp_controller, jax_controller]
const probabilities = [
  { action: 0, max: 10 },
  { action: 1, max: 70 },
  { action: 2, max: 100 },
]

export default function () {
  loginCounter = minimumuid + (loginCounter + 1) % maximumuid
  const draw = randomIntBetween(1,100);
  const action = probabilities.find(p => draw <= p.max).action

  actions[action](loginCounter);
}
