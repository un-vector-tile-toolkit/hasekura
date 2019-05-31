const config = require('config')
const express = require('express')
const mbgl = require('@mapbox/mapbox-gl-native')
const vtpbf = require('vt-pbf')
const sharp = require('sharp')
const fs = require('fs')
const Queue = require('better-queue')
const zlib = require('zlib')
const genericPool = require('generic-pool')

const htdocsPath = config.get('htdocsPath')
const port = config.get('port')
const widerRenderZoom = config.get('wideRenderZoom')


