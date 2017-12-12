// artisanalints
//
// request an artisanal int

const rp = require('request-promise-native')

function wait (timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

async function requestWithRetry (options, maxRetries = 10) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await rp(options)
    } catch (err) {
      const timeout = Math.pow(2, i)
      console.log('Waiting', timeout, 'ms')
      await wait(timeout)
      console.log('Retrying', err.message, i)
    }
  }
}

async function createArtisanalInt () {
  const json = await requestWithRetry({
    method: 'POST',
    uri: 'http://api.brooklynintegers.com/rest/',
    formData: { method: 'brooklyn.integers.create' },
    json: true
  })

  return json.integers[0].integer
}

module.exports = { createArtisanalInt }
