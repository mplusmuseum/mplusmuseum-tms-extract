const moment = require('moment')

exports.ifIndexDivisibleBy = (index, divisor, options) => {
  if ((index + 1) % divisor === 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifIndexNotDivisibleBy = (index, divisor, options) => {
  if ((index + 1) % divisor !== 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.indexOf = (context, ndx, options) => options.fn(context[ndx])

exports.ifEven = (n, options) => {
  if (n % 2 === 0 || n === 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifOdd = (n, options) => {
  if (n % 2 !== 0 && n > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifEqual = (v1, v2, options) => {
  if (v1 === v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifNotEqual = (v1, v2, options) => {
  if (v1 !== v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifgt = (v1, v2, options) => {
  if (v1 > v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifgte = (v1, v2, options) => {
  if (v1 >= v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.iflt = (v1, v2, options) => {
  if (v1 < v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.iflte = (v1, v2, options) => {
  if (v1 <= v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifEqualNumbers = (v1, v2, options) => {
  if (parseInt(v1, 10) === parseInt(v2, 10)) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifIsNotNull = (v1, options) => {
  if (v1 !== null) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.prettyMonth = (month) => {
  if (month === '01') {
    return 'January'
  }
  if (month === '02') {
    return 'February'
  }
  if (month === '03') {
    return 'March'
  }
  if (month === '04') {
    return 'April'
  }
  if (month === '05') {
    return 'May'
  }
  if (month === '06') {
    return 'June'
  }
  if (month === '07') {
    return 'July'
  }
  if (month === '08') {
    return 'August'
  }
  if (month === '09') {
    return 'September'
  }
  if (month === '10') {
    return 'October'
  }
  if (month === '11') {
    return 'November'
  }
  if (month === '12') {
    return 'December'
  }
  return month
}

exports.prettyDay = (d) => {
  const day = parseInt(d, 10)
  if (day === 1) {
    return '1<sup>st</sup>'
  }
  if (day === 2) {
    return '2<sup>nd</sup>'
  }
  if (day === 3) {
    return '3<sup>rd</sup>'
  }
  if (day === 21) {
    return '21<sup>st</sup>'
  }
  if (day === 22) {
    return '22<sup>nd</sup>'
  }
  if (day === 23) {
    return '23<sup>rd</sup>'
  }
  if (day === 31) {
    return '31<sup>st</sup>'
  }
  return `${day}<sup>th</sup>`
}

exports.prettyishDay = (d) => {
  const day = parseInt(d, 10)
  if (day === 1) {
    return '1st'
  }
  if (day === 2) {
    return '2nd'
  }
  if (day === 3) {
    return '3rd'
  }
  if (day === 21) {
    return '21st'
  }
  if (day === 22) {
    return '22nd'
  }
  if (day === 23) {
    return '23rd'
  }
  if (day === 31) {
    return '31st'
  }
  return `${day}th`
}

exports.dumpThis = (object) => {
  console.log(object)
  return ''
}

exports.dumpJSON = (object) => {
  let pre = "<pre class='admin_view'>"
  pre += JSON.stringify(object, null, 4)
  pre += '</pre>'
  return pre
}

exports.prettyNumber = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

exports.timePretty = t => moment(t).format('dddd, MMMM Do YYYY, h:mm:ss a')

exports.timeDiff = diff => moment.duration(diff).humanize()

exports.timeAgo = diff => moment(diff).fromNow()
