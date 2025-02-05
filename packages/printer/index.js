'use strict';
const util = require('util');
const qr = require('qr-image');
const iconv = require('iconv-lite');
const getPixels = require('get-pixels');
const { MutableBuffer } = require('mutable-buffer');
const EventEmitter = require('events');
const Image = require('./image');
const utils = require('./utils');
const _ = require('./commands');
const Promiseify = require('./promisify');

/**
 * [function ESC/POS Printer]
 * @param  {[Adapter]} adapter [eg: usb, network, or serialport]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
function Printer(adapter, options) {
  if (!(this instanceof Printer)) {
    return new Printer(adapter);
  }
  var self = this;
  EventEmitter.call(this);
  this.adapter = adapter;
  this.options = options;
  this.buffer = new MutableBuffer();
  this.encoding = options && options.encoding || 'GB18030';
  this.width = options && options.width || 48;
  this._model = null;
};

Printer.create = function (device) {
  const printer = new Printer(device);
  return Promise.resolve(Promiseify(printer))
};

/**
 * Printer extends EventEmitter
 */
util.inherits(Printer, EventEmitter);

/**
 * Set printer model to recognize model-specific commands.
 * Supported models: [ null, 'qsprinter' ]
 *
 * For generic printers, set model to null
 *
 * [function set printer model]
 * @param  {[String]}  model [mandatory]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.model = function (_model) {
  this._model = _model;
  return this;
};

/**
 * Set character code table
 * @param  {[Number]} codeTable
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.setCharacterCodeTable = function (codeTable) {
  this.buffer.write(_.ESC);
  this.buffer.write(_.TAB);
  this.buffer.writeUInt8(codeTable);
  return this;
};

/**
 * Fix bottom margin
 * @param  {[String]} size
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.marginBottom = function (size) {
  this.buffer.write(_.MARGINS.BOTTOM);
  this.buffer.writeUInt8(size);
  return this;
};

/**
 * Fix left margin
 * @param  {[String]} size
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.marginLeft = function (size) {
  this.buffer.write(_.MARGINS.LEFT);
  this.buffer.writeUInt8(size);
  return this;
};

/**
 * Fix right margin
 * @param  {[String]} size
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.marginRight = function (size) {
  this.buffer.write(_.MARGINS.RIGHT);
  this.buffer.writeUInt8(size);
  return this;
};

/**
 * [function print]
 * @param  {[String]}  content  [mandatory]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.print = function (content) {
  this.buffer.write(content);
  return this;
};
/**
 * [function print pure content with End Of Line]
 * @param  {[String]}  content  [mandatory]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.println = function (content) {
  return this.print(content + _.EOL);
};

/**
 * [function print pure content with End Of Line]
 * @param  {[String]}  content  [mandatory]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.newLine = function () {
  return this.print(_.EOL);
};

/**
 * [function Print encoded alpha-numeric text with End Of Line]
 * @param  {[String]}  content  [mandatory]
 * @param  {[String]}  encoding [optional]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.text = function (content, encoding) {
  return this.print(iconv.encode(content + _.EOL, encoding || this.encoding));
};


/**
 * [function Print draw line End Of Line]

 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.drawLine = function () {


  // this.newLine();
  for (var i = 0; i < this.width; i++) {
    this.buffer.write(Buffer.from("-"));
  }
  this.newLine();

  return this;
};



/**
 * [function Print  table   with End Of Line]
 * @param  {[List]}  data  [mandatory]
 * @param  {[String]}  encoding [optional]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.table = function (data, encoding) {


  var cellWidth = this.width / data.length;
  var lineTxt = "";

  for (var i = 0; i < data.length; i++) {

    lineTxt += data[i].toString();

    var spaces = cellWidth - data[i].toString().length;
    for (var j = 0; j < spaces; j++) {
      lineTxt += " ";

    }

  }
  this.buffer.write(iconv.encode(lineTxt + _.EOL, encoding || this.encoding));

  return this;



};



/**
 * [function Print  custom table  with End Of Line]
 * @param  {[List]}  data  [mandatory]
 * @param  {[String]}  encoding [optional]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.tableCustom = function (data, encoding) {

  var cellWidth = this.width / data.length;
  var secondLine = [];
  var secondLineEnabled = false;
  var lineStr = "";
  for (var i = 0; i < data.length; i++) {
    var tooLong = false;
    var obj = data[i];
    obj.text = obj.text.toString();

    if (obj.width) {
      cellWidth = this.width * obj.width;
    } else if (obj.cols) {
      cellWidth = obj.cols
    }


    // If text is too wide go to next line
    if (cellWidth < obj.text.length) {
      tooLong = true;
      obj.originalText = obj.text;
      obj.text = obj.text.substring(0, cellWidth - 1);
    }

    if (obj.align == "CENTER") {
      var spaces = (cellWidth - obj.text.toString().length) / 2;
      for (var j = 0; j < spaces; j++) {
        lineStr += " ";
      }
      if (obj.text != '')
        lineStr += obj.text;

      for (var j = 0; j < spaces - 1; j++) {
        lineStr += " ";
      }

    } else if (obj.align == "RIGHT") {
      var spaces = cellWidth - obj.text.toString().length;
      for (var j = 0; j < spaces; j++) {
        lineStr += " ";
      }
      if (obj.text != '')
        lineStr += obj.text;

    } else {
      if (obj.text != '')
        lineStr += obj.text;

      var spaces = cellWidth - obj.text.toString().length;
      for (var j = 0; j < spaces; j++) {
        lineStr += " ";
      }

    }



    if (tooLong) {
      secondLineEnabled = true;
      obj.text = obj.originalText.substring(cellWidth - 1);
      secondLine.push(obj);
    } else {
      obj.text = "";
      secondLine.push(obj);
    }
  }
  this.buffer.write(iconv.encode(lineStr + _.EOL, encoding || this.encoding));

  // Print the second line
  if (secondLineEnabled) {
    return this.tableCustom(secondLine);
  } else {
    return this;
  }
};



/**
 * [function Print encoded alpha-numeric text without End Of Line]
 * @param  {[String]}  content  [mandatory]
 * @param  {[String]}  encoding [optional]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.pureText = function (content, encoding) {
  return this.print(iconv.encode(content, encoding || this.encoding));
};

/**
 * [function encode text]
 * @param  {[String]}  encoding [mandatory]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.encode = function (encoding) {
  this.encoding = encoding;
  return this;
}

/**
 * [line feed]
 * @param  {[type]}    lines   [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.feed = function (n) {
  this.buffer.write(new Array(n || 1).fill(_.EOL).join(''));
  return this;
};

/**
 * [feed control sequences]
 * @param  {[type]}    ctrl     [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.control = function (ctrl) {
  this.buffer.write(_.FEED_CONTROL_SEQUENCES[
    'CTL_' + ctrl.toUpperCase()
  ]);
  return this;
};
/**
 * [text align]
 * @param  {[type]}    align    [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.align = function (align) {
  this.buffer.write(_.TEXT_FORMAT[
    'TXT_ALIGN_' + align.toUpperCase()
  ]);
  return this;
};
/**
 * [font family]
 * @param  {[type]}    family  [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.font = function (family) {
  this.buffer.write(_.TEXT_FORMAT[
    'TXT_FONT_' + family.toUpperCase()
  ]);
  if (family.toUpperCase() === 'A')
    this.width = this.options && this.options.width || 42;
  else
    this.width = this.options && this.options.width || 56;
  return this;
};
/**
 * [font style]
 * @param  {[type]}    type     [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.style = function (type) {
  switch (type.toUpperCase()) {

    case 'B':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_OFF);
      break;
    case 'I':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_OFF);
      break;
    case 'U':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_ON);
      break;
    case 'U2':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL2_ON);
      break;

    case 'BI':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_OFF);
      break;
    case 'BIU':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_ON);
      break;
    case 'BIU2':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL2_ON);
      break;
    case 'BU':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_ON);
      break;
    case 'BU2':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL2_ON);
      break;
    case 'IU':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_ON);
      break;
    case 'IU2':
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_ON);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL2_ON);
      break;

    case 'NORMAL':
    default:
      this.buffer.write(_.TEXT_FORMAT.TXT_BOLD_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_ITALIC_OFF);
      this.buffer.write(_.TEXT_FORMAT.TXT_UNDERL_OFF);
      break;

  }
  return this;
};

/**
 * [font size]
 * @param  {[String]}  width   [description]
 * @param  {[String]}  height  [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.size = function (width, height) {
  if (2 >= width && 2 >= height) {
    this.buffer.write(_.TEXT_FORMAT.TXT_NORMAL);
    if (2 == width && 2 == height) {
      this.buffer.write(_.TEXT_FORMAT.TXT_4SQUARE);
    } else if (1 == width && 2 == height) {
      this.buffer.write(_.TEXT_FORMAT.TXT_2HEIGHT);
    } else if (2 == width && 1 == height) {
      this.buffer.write(_.TEXT_FORMAT.TXT_2WIDTH);
    }
  } else {
    this.buffer.write(_.TEXT_FORMAT.TXT_CUSTOM_SIZE(width, height));
  }
  return this;
};

/**
 * [set character spacing]
 * @param  {[type]}    n     [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.spacing = function (n) {
  if (n === undefined || n === null) {
    this.buffer.write(_.CHARACTER_SPACING.CS_DEFAULT);
  } else {
    this.buffer.write(_.CHARACTER_SPACING.CS_SET);
    this.buffer.writeUInt8(n);
  }
  return this;
}

/**
 * [set line spacing]
 * @param  {[type]} n [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.lineSpace = function (n) {
  if (n === undefined || n === null) {
    this.buffer.write(_.LINE_SPACING.LS_DEFAULT);
  } else {
    this.buffer.write(_.LINE_SPACING.LS_SET);
    this.buffer.writeUInt8(n);
  }
  return this;
};

/**
 * [hardware]
 * @param  {[type]}    hw       [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.hardware = function (hw) {
  this.buffer.write(_.HARDWARE['HW_' + hw.toUpperCase()]);
  return this;
};
/**
 * [barcode]
 * @param  {[type]}    code     [description]
 * @param  {[type]}    type     [description]
 * @param  {[type]}    options  [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.barcode = function (code, type, options) {
  options = options || {};
  var width, height, position, font, includeParity;
  // Backward compatibility
  width = arguments[2];
  if (typeof width === 'string' || typeof width === 'number') {
    width = arguments[2];
    height = arguments[3];
    position = arguments[4];
    font = arguments[5];
  } else {
    width = options.width;
    height = options.height;
    position = options.position;
    font = options.font;
    includeParity = options.includeParity !== false; // true by default
  }

  type = type || 'EAN13'; // default type is EAN13, may a good choice ?
  var convertCode = String(code), parityBit = '', codeLength = '';
  if (typeof type === 'undefined' || type === null) {
    throw new TypeError('barcode type is required');
  }
  if (type === 'EAN13' && convertCode.length !== 12) {
    throw new Error('EAN13 Barcode type requires code length 12');
  }
  if (type === 'EAN8' && convertCode.length !== 7) {
    throw new Error('EAN8 Barcode type requires code length 7');
  }
  if (this._model === 'qsprinter') {
    this.buffer.write(_.MODEL.QSPRINTER.BARCODE_MODE.ON);
  }
  if (this._model === 'qsprinter') {
    // qsprinter has no BARCODE_WIDTH command (as of v7.5)
  } else if (width >= 1 && width <= 5) {
    this.buffer.write(_.BARCODE_FORMAT.BARCODE_WIDTH[width]);
  } else {
    this.buffer.write(_.BARCODE_FORMAT.BARCODE_WIDTH_DEFAULT);
  }
  if (height >= 1 && height <= 255) {
    this.buffer.write(_.BARCODE_FORMAT.BARCODE_HEIGHT(height));
  } else {
    if (this._model === 'qsprinter') {
      this.buffer.write(_.MODEL.QSPRINTER.BARCODE_HEIGHT_DEFAULT);
    } else {
      this.buffer.write(_.BARCODE_FORMAT.BARCODE_HEIGHT_DEFAULT);
    }
  }
  if (this._model === 'qsprinter') {
    // Qsprinter has no barcode font
  } else {
    this.buffer.write(_.BARCODE_FORMAT[
      'BARCODE_FONT_' + (font || 'A').toUpperCase()
    ]);
  }
  this.buffer.write(_.BARCODE_FORMAT[
    'BARCODE_TXT_' + (position || 'BLW').toUpperCase()
  ]);
  this.buffer.write(_.BARCODE_FORMAT[
    'BARCODE_' + ((type || 'EAN13').replace('-', '_').toUpperCase())
  ]);
  if (includeParity) {
    if (type === 'EAN13' || type === 'EAN8') {
      parityBit = utils.getParityBit(code);
    }
  }
  if (type == 'CODE128' || type == 'CODE93') {
    codeLength = utils.codeLength(code);
  }
  this.buffer.write(codeLength + code + (includeParity ? parityBit : '') + '\x00'); // Allow to skip the parity byte
  if (this._model === 'qsprinter') {
    this.buffer.write(_.MODEL.QSPRINTER.BARCODE_MODE.OFF);
  }
  return this;
};

/**
 * [print qrcode]
 * @param  {[type]} code    [description]
 * @param  {[type]} version [description]
 * @param  {[type]} level   [description]
 * @param  {[type]} size    [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.qrcode = function (code, version, level, size) {
  if (this._model !== 'qsprinter') {
    this.buffer.write(_.CODE2D_FORMAT.TYPE_QR);
    this.buffer.write(_.CODE2D_FORMAT.CODE2D);
    this.buffer.writeUInt8(version || 3);
    this.buffer.write(_.CODE2D_FORMAT[
      'QR_LEVEL_' + (level || 'L').toUpperCase()
    ]);
    this.buffer.writeUInt8(size || 6);
    this.buffer.writeUInt16LE(code.length);
    this.buffer.write(code);
  } else {
    const dataRaw = iconv.encode(code, 'utf8');
    if (dataRaw.length < 1 && dataRaw.length > 2710) {
      throw new Error('Invalid code length in byte. Must be between 1 and 2710');
    }

    // Set pixel size
    if (!size || (size && typeof size !== 'number'))
      size = _.MODEL.QSPRINTER.CODE2D_FORMAT.PIXEL_SIZE.DEFAULT;
    else if (size && size < _.MODEL.QSPRINTER.CODE2D_FORMAT.PIXEL_SIZE.MIN)
      size = _.MODEL.QSPRINTER.CODE2D_FORMAT.PIXEL_SIZE.MIN;
    else if (size && size > _.MODEL.QSPRINTER.CODE2D_FORMAT.PIXEL_SIZE.MAX)
      size = _.MODEL.QSPRINTER.CODE2D_FORMAT.PIXEL_SIZE.MAX;
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.PIXEL_SIZE.CMD);
    this.buffer.writeUInt8(size);

    // Set version
    if (!version || (version && typeof version !== 'number'))
      version = _.MODEL.QSPRINTER.CODE2D_FORMAT.VERSION.DEFAULT;
    else if (version && version < _.MODEL.QSPRINTER.CODE2D_FORMAT.VERSION.MIN)
      version = _.MODEL.QSPRINTER.CODE2D_FORMAT.VERSION.MIN;
    else if (version && version > _.MODEL.QSPRINTER.CODE2D_FORMAT.VERSION.MAX)
      version = _.MODEL.QSPRINTER.CODE2D_FORMAT.VERSION.MAX;
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.VERSION.CMD);
    this.buffer.writeUInt8(version);

    // Set level
    if (!level || (level && typeof level !== 'string'))
      level = _.CODE2D_FORMAT.QR_LEVEL_L;
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.LEVEL.CMD);
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.LEVEL.OPTIONS[level.toUpperCase()]);

    // Transfer data(code) to buffer
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.SAVEBUF.CMD_P1);
    this.buffer.writeUInt16LE(dataRaw.length + _.MODEL.QSPRINTER.CODE2D_FORMAT.LEN_OFFSET);
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.SAVEBUF.CMD_P2);
    this.buffer.write(dataRaw);

    // Print from buffer
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.PRINTBUF.CMD_P1);
    this.buffer.writeUInt16LE(dataRaw.length + _.MODEL.QSPRINTER.CODE2D_FORMAT.LEN_OFFSET);
    this.buffer.write(_.MODEL.QSPRINTER.CODE2D_FORMAT.PRINTBUF.CMD_P2);
  }
  return this;
};

/**
 * [print qrcode image]
 * @param  {[type]}   content  [description]
 * @param  {[type]}   options  [description]
 * @param  {[Function]} callback [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.qrimage = function (content, options, callback) {
  var self = this;
  if (typeof options == 'function') {
    callback = options;
    options = null;
  }
  options = options || { type: 'png', mode: 'dhdw' };
  var buffer = qr.imageSync(content, options);
  var type = ['image', options.type].join('/');
  getPixels(buffer, type, function (err, pixels) {
    if (err) return callback && callback(err);
    self.raster(new Image(pixels), options.mode);
    callback && callback.call(self, null, self);
  });
  return this;
};

/**
 * [image description]
 * @param  {[type]} image   [description]
 * @param  {[type]} density [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.image = async function (image, density) {
  if (!(image instanceof Image))
    throw new TypeError('Only escpos.Image supported');
  density = density || 'd24';
  var n = !!~['d8', 's8'].indexOf(density) ? 1 : 3;
  var header = _.BITMAP_FORMAT['BITMAP_' + density.toUpperCase()];
  var bitmap = image.toBitmap(n * 8);
  var self = this;

  // added a delay so the printer can process the graphical data
  // when connected via slower connection ( e.g.: Serial)
  this.lineSpace(0); // set line spacing to 0
  bitmap.data.forEach(async (line) => {
    self.buffer.write(header);
    self.buffer.writeUInt16LE(line.length / n);
    self.buffer.write(line);
    self.buffer.write(_.EOL);
    await new Promise((resolve, reject) => {
      setTimeout(() => { resolve(true) }, 200);
    });
  });
  return this.lineSpace();
};

/**
 * [raster description]
 * @param  {[type]} image [description]
 * @param  {[type]} mode  [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.raster = function (image, mode) {
  if (!(image instanceof Image))
    throw new TypeError('Only escpos.Image supported');
  mode = mode || 'normal';
  if (mode === 'dhdw' ||
    mode === 'dwh' ||
    mode === 'dhw') mode = 'dwdh';
  var raster = image.toRaster();
  var header = _.GSV0_FORMAT['GSV0_' + mode.toUpperCase()];
  this.buffer.write(header);
  this.buffer.writeUInt16LE(raster.width);
  this.buffer.writeUInt16LE(raster.height);
  this.buffer.write(raster.data);
  return this;
};

/**
 * [function Send pulse to kick the cash drawer]
 * @param  {[type]} pin [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.cashdraw = function (pin) {
  this.buffer.write(_.CASH_DRAWER[
    'CD_KICK_' + (pin || 2)
  ]);
  return this;
};

/**
 * Printer Buzzer (Beep sound)
 * @param  {[Number]} n Refers to the number of buzzer times
 * @param  {[Number]} t Refers to the buzzer sound length in (t * 100) milliseconds.
 */
Printer.prototype.beep = function (n, t) {
  this.buffer.write(_.BEEP);
  this.buffer.writeUInt8(n);
  this.buffer.writeUInt8(t);
  return this;
};

/**
 * Send data to hardware and flush buffer
 * @param  {Function} callback
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.flush = function (callback) {
  var buf = this.buffer.flush();
  this.adapter.write(buf, callback);
  return this;
};

/**
 * [function Cut paper]
 * @param  {[type]} part [description]
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.cut = function (part, feed) {
  this.feed(feed || 3);
  this.buffer.write(_.PAPER[
    part ? 'PAPER_PART_CUT' : 'PAPER_FULL_CUT'
  ]);
  return this;
};

/**
 * [close description]
 * @param  {Function} callback [description]
 * @param  {[type]}   options  [description]
 * @return {[type]}            [description]
 */
Printer.prototype.close = function (callback, options) {
  var self = this;
  return this.flush(function () {
    self.adapter.close(callback, options);
  });
};

/**
 * [color select between two print color modes, if your printer supports it]
 * @param  {Number} color - 0 for primary color (black) 1 for secondary color (red)
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.color = function (color) {
  this.buffer.write(_.COLOR[
    color === 0 || color === 1 ? color : 0
  ]);
  return this;
};

/**
 * [reverse colors, if your printer supports it]
 * @param {Boolean} bool - True for reverse, false otherwise
 * @return {[Printer]} printer  [the escpos printer instance]
 */
Printer.prototype.setReverseColors = function (bool) {
  this.buffer.write(bool ? _.COLOR.REVERSE : _.COLOR.UNREVERSE);
  return this;
};


/**
 * [writes a low level command to the printer buffer]
 *
 * @usage
 * 1) raw('1d:77:06:1d:6b:02:32:32:30:30:30:30:32:30:30:30:35:30:35:00:0a')
 * 2) raw('1d 77 06 1d 6b 02 32 32 30 30 30 30 32 30 30 30 35 30 35 00 0a')
 * 3) raw(Buffer.from('1d77061d6b0232323030303032303030353035000a','hex'))
 *
 * @param data {Buffer|string}
 * @returns {Printer}
 */
Printer.prototype.raw = function raw(data) {
  if (Buffer.isBuffer(data)) {
    this.buffer.write(data);
  } else if (typeof data === 'string') {
    data = data.toLowerCase();
    this.buffer.write(Buffer.from(data.replace(/(\s|:)/g, ''), 'hex'));
  }
  return this;
};

Printer.prototype.lineTitle = function lineTitle(title, charLength = 2) {
  const strWidth = title.length * charLength;
  const otherWidth = this.width - strWidth;
  let str = '';
  for (let i = 0; i < this.width; i += 1) {
    if (i >= otherWidth / 2 && i < otherWidth / 2 + strWidth) {
      const temp = str;
      str += title;
      str += temp;
      break;
    }
    str += '-';
  }

  return this.align('CT').size(1, 1).text(str);
}

/**
 * 文字左右对齐排版打印
 * @param leftStr   左边文本
 * @param rightStr    右边文本
 * @param wrapByte 左边文本多少个字节后折行
 */
Printer.prototype.controlText = function controlText(leftStr, rightStr, wrapByte = 32) {
  var l_bytes = utils.bytesLength(leftStr.toString());
  var r_bytes = utils.bytesLength(rightStr.toString());

  let str = '';
  let tempStr = '';
  let leftText = '';

  let spaceLength = 0;
  if (l_bytes > wrapByte) {
    tempStr = leftStr.substring(wrapByte / 2, leftStr.length);
    leftText = leftStr.substring(0, wrapByte / 2);
    const tempBytes = utils.bytesLength(leftText);
    spaceLength = this.width - tempBytes - r_bytes;

    for (let i = 0; i < spaceLength; i++) {
      leftText += ' '
    }
    str = leftText + rightStr;

    this.text(str);
    this.text(tempStr);
  } else {
    spaceLength = this.width - l_bytes - r_bytes;
    leftText = leftStr;
    for (let i = 0; i< spaceLength; i++) {
      leftText += ' ';
    }
    str = leftText + rightStr;
    this.text(str);
  }
  return this;
}

/**
 * 文字三列布局
 * @param text 文本
 * @param wrapByte 左边文本多少个字节后折行
   */
Printer.prototype.threeColumnLayout = function threeColumnLayout(text, wrapByte = 32) {
  const l_bytes = utils.bytesLength(text.leftTxt.toString());
  const c_bytes = utils.bytesLength(text.centerTxt.toString());
  const r_bytes = utils.bytesLength(text.rightTxt.toString());

  let str = '';
  let tempStr = '';
  let spaceLength = 0;
  const width = this.width;

  if (l_bytes > wrapByte) {
    tempStr = text.leftTxt.substring(wrapByte / 2, text.leftTxt.length);
    str = text.leftTxt.substring(0, wrapByte / 2);
    const tempBytes = utils.bytesLength(text.leftTxt);

    if (text.leftSpace) {
      this.text(utils.spaceText(str,text.rightTxt, width));
    } else {
      spaceLength = (width - tempBytes - c_bytes - r_bytes) / 2;
      spaceLength = Number(Math.round(spaceLength))

      for (let i = 0; i < spaceLength; i++) {
        str += ' '
      }
      str = str + text.centerTxt
      
      for (let i = 0; i < spaceLength; i++) {
        str += ' '
      }
      str = str + text.rightTxt;
      this.text(str);
    }
    this.text(tempStr);
  } else {
    str = text.leftTxt;

    if (text.leftSpace) {
      const txtL = utils.spaceText(str, text.centerTxt, text.leftSpace)
      const txt = utils.spaceText(txtL, text.rightTxt, width);
      
      this.text(txt);
    } else {
      spaceLength = (width - l_bytes - c_bytes - r_bytes) / 2;
      spaceLength = Number(Math.floor(spaceLength))
      
      for (let i = 0; i< spaceLength; i++) {
        str+=' '
      }
      str = str + text.centerTxt
      for(let i = 0; i< spaceLength; i++) {
        str+=' ';
      }

      str = str + text.rightTxt;
      this.text(str);
    }
  }
     
  return this;
}

/**
 * 四列表格布局
 * @param {{text:string; space?:number}[]} thead 表头
 * @param {Tbody[]} tbody  内容
 * @param wrapByte 折行字节
 * @interface Tbody {
 * title?:string;
 * col1:string;
 * col2:string;
 * col3:string;
 * col4:string;
 * }
 */
Printer.prototype.fourColumnLayout = function (thead, tbody, wrapByte = 16) {
  // const width = this.width;
  if (thead && thead.length > 0) {

    const th1_length = utils.bytesLength(thead[0].text.toString()) + utils.bytesLength(thead[1].text.toString()) + thead[0].space;
    const th2_length = th1_length + thead[1].space + utils.bytesLength(thead[1].text.toString());
    const th3_length = th2_length + thead[2].space + utils.bytesLength(thead[2].text.toString());
    
    
    let h_str = thead[0].text;

    for(let i = 0;i < thead[0].space; i++) {
      h_str+=' '
    }
    h_str = h_str + thead[1].text;
    for(let i = 0; i< thead[1].space; i++) {
      h_str+=' '
    }
    h_str = h_str + thead[2].text;
    for(let i = 0;i < thead[2].space; i++) {
      h_str+=' '
    }
    h_str = h_str + thead[3].text;

    this.text(h_str);

    tbody.forEach((itemx,index)=>{
      
      let txt1 = '';
      
      const firstTxtBytes = utils.bytesLength(itemx.col1.toString());
      let tempStr = '';
      if (firstTxtBytes > wrapByte) {
        tempStr = itemx.col1.substring(wrapByte / 2, itemx.col1.length);
        const subStr = itemx.col1.substring(0, wrapByte/2);
        txt1 = utils.spaceText(subStr, itemx.col2, th1_length);
      } else {
        txt1 = utils.spaceText(itemx.col1, itemx.col2, th1_length);
      }

      if (itemx.title) {
        this.align('LT').text(itemx.title)
      }
      const txt2 = utils.spaceText(txt1, itemx.col3, th2_length);
      const txt3 = utils.spaceText(txt2, itemx.col4, th3_length);
      if (itemx.options) {
        this.text(txt3)
      } else {
        this.text(txt3)
      }
      if (tempStr != '') {
        if (itemx.options) {
          this.text(tempStr)
        } else {
          this.text(tempStr)
        }  
      }
    })

  }
  return this;
}


/**
 * Printer Supports
 */
Printer.Printer = Printer;
Printer.Image = require('./image');
Printer.command = require('./commands');
Printer.Printer2 = require('./promisify');

/**
 * [exports description]
 * @type {[type]}
 */
module.exports = Printer;
