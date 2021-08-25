const chalk = require('chalk')
const fs = require('fs-extra')
const childProcess = require('child_process')

// 封装log函数
exports.log = {
  warning (msg = '') {
    console.log(chalk.yellow(`${msg}`))
  },
  error (msg = '') {
    console.log(chalk.red(`${msg}`))
  },
  success (msg = '') {
    console.log(chalk.green(`${msg}`))
  }
}

/**
 * copyFiles 拷贝下载的repo资源
 * @param { string } tempPath 待拷贝的资源路径（绝对路径）
 * @param { string } targetPath 资源放置路径（绝对路径）
 * @param { Array<string> } excludes 需要排除的资源名称（会自动移除其所有子文件）
 */
exports.copyFiles = async (tempPath, targetPath, excludes = []) => {
  const removeFiles = ['./git', './changelogs']
  // 资源拷贝
  await fs.copySync(tempPath, targetPath)

  // 删除额外的资源文件
  if (excludes && excludes.length) {
    await Promise.all(
      excludes.map(file => async () =>
        await fs.removeSync(path.resolve(targetPath, file))
      )
    )
  }
}

// 判断是否是函数
const isFunction = val => {
  return typeof val === 'function'
}

exports.isFunction = isFunction

// 解析用户输入的参数
exports.parseCmdParams = cmd => {
  if (!cmd) return {}
  const resOps = {}
  if (cmd.options) {
    cmd.options.forEach(option => {
      const key = option.long.replace(/^--/, '')
      if (cmd[key] && !isFunction(cmd[key])) {
        resOps[key] = cmd[key]
      }
    })
  }
  return resOps
}

// 运行cmd命令
const runCmd = cmd => {
  return new Promise((resolve, reject) => {
    childProcess.exec(cmd, (err, ...arg) => {
      if (err) return reject(err)
      return resolve(...arg)
    })
  })
}

exports.runCmd = runCmd

/**
 * getGitUser
 * @description 获取git用户信息
 */
exports.getGitUser = () => {
  return new Promise(async resolve => {
    const user = {}
    try {
      const [name] = await runCmd('git config user.name')
      const [email] = await runCmd('git config user.email')
      // 移除结尾的换行符
      if (name) user.name = name.replace(/\n/g, '')
      if (email) user.email = `<${email || ''}>`.replace(/\n/g, '')
    } catch (error) {
      log.error('获取用户Git信息失败')
      reject(error)
    } finally {
      resolve(user)
    }
  })
}
