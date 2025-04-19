import merge from 'lodash/merge'
import ResultCollector from './analytics/result_collector'
import Events from './common/events'
import ImageDebug from './common/image_debug'
import ImageWrapper from './common/image_wrapper'
import TypeDefs from './common/typedefs' // eslint-disable-line no-unused-vars
import Config from './config/config'
import BarcodeDecoder from './decoder/barcode_decoder'
import CameraAccess from './input/camera_access'
import Quagga from './quagga/quagga'

import * as Readers from './reader/index'

const instance = new Quagga()
const _context = instance.context

const QuaggaJSStaticInterface = {
  init(config, cb, imageWrapper, quaggaInstance = instance) {
    let promise
    if (!cb) {
      promise = new Promise((resolve, reject) => {
        cb = (err) => { err ? reject(err) : resolve() }
      })
    }
    quaggaInstance.context.config = merge({}, Config, config)
    // TODO #179: pending restructure in Issue #179, we are temp disabling workers
    if (quaggaInstance.context.config.numOfWorkers > 0) {
      quaggaInstance.context.config.numOfWorkers = 0
    }
    if (imageWrapper) {
      quaggaInstance.context.onUIThread = false
      quaggaInstance.initializeData(imageWrapper)
      if (cb) {
        cb()
      }
    }
    else {
      quaggaInstance.initInputStream(cb)
    }
    return promise
  },
  start() {
    return instance.start()
  },
  stop() {
    return instance.stop()
  },
  pause() {
    _context.stopped = true
  },
  onDetected(callback) {
    if (!callback || (typeof callback !== 'function' && (typeof callback !== 'object' || !callback.callback))) {
      console.trace('* warning: Quagga.onDetected called with invalid callback, ignoring')
      return
    }
    Events.subscribe('detected', callback)
  },
  offDetected(callback) {
    Events.unsubscribe('detected', callback)
  },
  onProcessed(callback) {
    if (!callback || (typeof callback !== 'function' && (typeof callback !== 'object' || !callback.callback))) {
      console.trace('* warning: Quagga.onProcessed called with invalid callback, ignoring')
      return
    }
    Events.subscribe('processed', callback)
  },
  offProcessed(callback) {
    Events.unsubscribe('processed', callback)
  },
  setReaders(readers) {
    if (!readers) {
      console.trace('* warning: Quagga.setReaders called with no readers, ignoring')
      return
    }
    instance.setReaders(readers)
  },
  registerReader(name, reader) {
    if (!name) {
      console.trace('* warning: Quagga.registerReader called with no name, ignoring')
      return
    }
    if (!reader) {
      console.trace('* warning: Quagga.registerReader called with no reader, ignoring')
      return
    }
    instance.registerReader(name, reader)
  },
  registerResultCollector(resultCollector) {
    if (resultCollector && typeof resultCollector.addResult === 'function') {
      _context.resultCollector = resultCollector
    }
  },
  get canvas() {
    return _context.canvasContainer
  },
  decodeSingle(config, resultCallback) {
    const quaggaInstance = new Quagga()
    config = merge({
      inputStream: {
        type: 'ImageStream',
        sequence: false,
        size: 800,
        src: config.src,
      },
      numOfWorkers: (ENV.development && config.debug) ? 0 : 1,
      locator: {
        halfSample: false,
      },
    }, config)
    // TODO #175: restructure worker support so that it will work with typescript using worker-loader
    // https://webpack.js.org/loaders/worker-loader/
    if (config.numOfWorkers > 0) {
      config.numOfWorkers = 0
    }
    // workers require Worker and Blob support presently, so if no Blob or Worker then set
    // workers to 0.
    if (config.numOfWorkers > 0 && (typeof Blob === 'undefined' || typeof Worker === 'undefined')) {
      console.warn('* no Worker and/or Blob support - forcing numOfWorkers to 0')
      config.numOfWorkers = 0
    }
    return new Promise((resolve, reject) => {
      try {
        this.init(config, () => {
          Events.once('processed', (result) => {
            quaggaInstance.stop()
            if (resultCallback) {
              resultCallback.call(null, result)
            }
            resolve(result)
          }, true)
          quaggaInstance.start()
        }, null, quaggaInstance)
      }
      catch (err) {
        reject(err)
      }
    })
  },
  // add the usually expected "default" for use with require, build step won't allow us to
  // write to module.exports so do it here.
  get default() {
    return QuaggaJSStaticInterface
  },
  Readers,
  CameraAccess,
  ImageDebug,
  ImageWrapper,
  ResultCollector,
}

export default QuaggaJSStaticInterface
// export BarcodeReader and other utilities for external plugins
export {
  BarcodeDecoder,
  CameraAccess,
  ImageDebug,
  ImageWrapper,
  Readers,
  ResultCollector,
}
