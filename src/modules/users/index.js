const fs = require('fs')

class Users {
  get (role = null) {
    const userDir = `${process.cwd()}/app/data/users`

    if (!fs.existsSync(`${process.cwd()}/app/data`)) {
      fs.mkdirSync(`${process.cwd()}/app/data`)
    }
    if (!fs.existsSync(`${process.cwd()}/app/data/users`)) {
      fs.mkdirSync(`${process.cwd()}/app/data/users`)
    }
    let users = fs
      .readdirSync(userDir)
      .filter(file => {
        const fileFragments = file.split('.')
        if (fileFragments.length !== 2) return false
        if (fileFragments[1] === 'json') return true
      })
      .map(userfile => {
        const user = fs.readFileSync(`${userDir}/${userfile}`, 'utf-8')
        return JSON.parse(user)
      })
    if (role === 'developer') return users.filter(user => user.developer)
    if (role === 'staff') return users.filter(user => user.staff)
    if (role === 'admin') return users.filter(user => user.admin)
    return users
  }
}
module.exports = Users
