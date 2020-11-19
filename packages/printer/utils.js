/**
 * [getParityBit description]
 * @return {[type]} [description]
 */
exports.getParityBit = function (str) {
  var parity = 0, reversedCode = str.split('').reverse().join('');
  for (var counter = 0; counter < reversedCode.length; counter += 1) {
    parity += parseInt(reversedCode.charAt(counter), 10) * Math.pow(3, ((counter + 1) % 2));
  }
  return String((10 - (parity % 10)) % 10);
};

exports.codeLength = function (str) {
  let buff = Buffer.from((str.length).toString(16), 'hex');
  return buff.toString();
}

function bytesLength(str) {
  let bytesCount = 0;
  for (let i = 0; i< str.length; i++) {
    const c = str.charAt(i);
    if (/^[\u0000-\u00ff]$/.test(c)){
       //匹配双字节
      bytesCount += 1;
    } else {
      bytesCount += 2;
    }
  }
  return bytesCount;
}

exports.bytesLength = bytesLength

exports.spaceText = function(text1, text2, width) {
  const l_bytes = bytesLength(text1.toString());
  const r_bytes = bytesLength(text2.toString());
  let space = width - l_bytes - r_bytes;
  let str = text1;

  for(let i=0 ; i< space;i++) {
    str +=' ';
  }
  str = str + text2;

  return str;
}
