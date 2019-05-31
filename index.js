const config = require('config')
const express = require('express')
const mbgl = require('@mapbox/mapbox-gl-native')
const vtpbf = require('vt-pbf')
const sharp = require('sharp')
const fs = require('fs')
const Queue = require('better-queue')
const zlib = require('zlib')
const genericPool = require('generic-pool')
const fetch = require('node-fetch')

const htdocsPath = config.get('htdocsPath')
const port = config.get('port')
const wideRenderZoom = config.get('wideRenderZoom')
const emptyTile = vtpbf({ features: [] })
let style
let maps

fetch('https://hfu.github.io/macrostyle/style.json')
  .then(res => res.json())
  .then(json => {
    style = json
    maps = prepareMaps()
  })

const tile2long = (x, z) => {
  return x / 2 ** z * 360 - 180
}

const tile2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / 2 ** z
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

mbgl.on('message', msg => {
  console.log(msg)
})

const dimension = z => {
  return z > wideRenderZoom ? 1024 : 512
}

const mbglRequestQueue = new Queue((req, cb) => {
  let etag
  let status
  fetch(req.url)
    .then(res => {
      etag = res.headers.raw()['etag']
      status = res.status
      console.log(`${status} ${req.kind} ${req.url}`)
      return res.buffer()
    })
    .then(buffer => {
      cb(null, {
        modified: new Date(),
        expires: new Date(),
        etag: etag,
        data: status === 200 ? buffer : emptyTile
      })
    })
    .catch(e => {
      console.log(`${req.url} was caught.`)
      cb(e)
    })
}, { concurrent: 20 })

const prepareMaps = () => { return genericPool.createPool({
  create: () => {
    const map = new mbgl.Map({
      request: (req, cb) => {
        mbglRequestQueue.push(req, (err, data) => {
          if (err) cb(err)
          cb(null, data)
        })
      },
      mode: 'tile',
    })
    map.load(style)
    return map
  },
  destroy: (map) => {
    map.release()
  }
}, { max: 4, min: 2 }) }

const tileQueue = new Queue((r, cb) => {
  const [z, x, y] = [r.z, r.x, r.y]
  const center = [
    tile2long(x + 0.5, z),
    tile2lat(y + 0.5, z)
  ]
  const d = dimension(z)
  maps.acquire().then(map => {
    map.render({
      zoom: z, center: center,
      width: d, height: d
    }, (err, buffer) => {
      maps.release(map)
      if (err) return cb(err)
      let image = sharp(buffer, {
        raw: {
          width: d, height: d, channels: 4
        }
      })
      if (z > wideRenderZoom) {
        image = image.extract({
          left: 256, top: 256, width: 512, height: 512
        })
      }
      cb(null, image)
    })
  })
}, { concurrent: 2 })

const app = express()
app.use(express.static(htdocsPath))

app.get('/:z/:x/:y.png', (req, res) => {
  tileQueue.push({
    z: parseInt(req.params.z),
    x: parseInt(req.params.x),
    y: parseInt(req.params.y)
  }, (err, image) => {
    if (err) {
      res.set('content-type', 'text/plain')
      res.send(err)
    } else {
      res.set('content-type', 'image/png')
      image.png().toBuffer()
        .then((result) => {
          res.send(result)
        })
    }
  })
})

app.listen(port)
