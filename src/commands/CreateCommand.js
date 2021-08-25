#!/usr/bin/env node
const path = require('path')
const ora = require('ora')
const fs = require('fs-extra')
const download = require('download-git-repo')
const {
  copyFiles,
  parseCmdParams,
  getGitUser,
  runCmd,
  log
} = require('../utils')
const { exit } = require('process')
const inquirer = require('inquirer')
const { InquirerConfig, RepoPath } = require('../utils/config')

/**
 * class 项目创建命令
 *
 * @description
 * @param {} source 用户提供的文件夹名称
 * @param {} destination 用户输入的create命令的参数
 */
class Creator {
  constructor (source, destination, ops = {}) {
    this.source = source
    this.cmdParams = parseCmdParams(destination)
    this.RepoMaps = Object.assign(
      {
        // 项目模板地址
        repo: RepoPath,
        // 本地 cli 项目内部临时存放的项目模板地址
        temp: path.join(__dirname, '../../__temp__'),
        // 安装的目标地址
        target: this.genTargetPath(this.source)
      },
      ops
    )
    this.gitUser = {} // 存放用户 git 信息
    this.spinner = ora() // 实例化菊花 loading
    this.init()
  }

  // 生成目标文件夹的绝对路径
  genTargetPath (relPath = 'vue-ts-template') {
    return path.resolve(process.cwd(), relPath)
  }

  // 初始化函数
  async init () {
    try {
      // 检查目标路径文件是否正确
      await this.checkFolderExist()
      // 拉取 git 上的 vue+ts+ele 的项目模板
      // 存放在临时文件夹中
      await this.downloadRepo()
      // 把下载下来的资源文件，拷贝到目标文件夹
      await this.copyRepoFiles()
      // 根据用户git信息等，修改项目模板中package.json的一些信息
      await this.updatePkgFile()
      // 对我们的项目进行git初始化
      await this.initGit()
      // 最后安装依赖、启动项目等！
      await this.runApp()
    } catch (error) {
      console.log('')
      log.error(error)
      exit(1)
    } finally {
      this.spinner.stop()
    }
  }

  // 监测文件夹是否存在
  checkFolderExist () {
    return new Promise(async (resolve, reject) => {
      const { target } = this.RepoMaps
      // 如果 create 附加了 --force 或 -f 参数，则直接执行覆盖操作
      if (this.cmdParams.force) {
        await fs.removeSync(target)
        return resolve()
      }
      try {
        // 否则进行文件夹检查
        const isTarget = await fs.pathExistsSync(target)
        if (!isTarget) return resolve()

        // 文件夹存在时，选择操作
        const { recover } = await inquirer.prompt(InquirerConfig.folderExist)
        // 当覆盖时, 先删除
        if (recover === 'cover') {
          await fs.removeSync(target)
          return resolve()
        } else if (recover === 'newFolder') {
          const { inputNewName } = await inquirer.prompt(InquirerConfig.rename)
          this.source = inputNewName
          this.RepoMaps.target = this.genTargetPath(`./${inputNewName}`)
          return resolve()
        } else {
          exit(1)
        }
      } catch (error) {
        log.error(`[vta]Error:${error}`)
        exit(1)
      }
    })
  }

  // 下载repo资源
  downloadRepo () {
    this.spinner.start('正在拉取项目模板...')
    const { repo, temp } = this.RepoMaps
    return new Promise(async (resolve, reject) => {
      // 如果本地临时文件夹存在，则先删除临时文件夹
      await fs.removeSync(temp)
      /**
       * 第一个参数为远程仓库地址，注意是类型:作者/库
       * 第二个参数为下载到的本地地址，
       * 后面还可以继续加一个配置参数对象，最后一个是回调函数，
       */
      download(repo, temp, async err => {
        if (err) return reject(err)
        this.spinner.succeed('模版下载成功')
        return resolve()
      })
    })
  }

  // 拷贝repo资源
  async copyRepoFiles () {
    const { temp, target } = this.RepoMaps
    await copyFiles(temp, target, ['./git', './changelogs'])
  }

  /**
   * updatePkgFile
   * @description 更新package.json文件
   */
  async updatePkgFile () {
    // 菊花转起来！
    this.spinner.start('正在更新package.json...')
    // 获取当前的项目内的package.json文件的据对路径
    const pkgPath = path.resolve(this.RepoMaps.target, 'package.json')
    // 定义需要移除的字段
    // 这些字段本身只是git项目配置的内容，而我们业务项目是不需要的
    const unnecessaryKey = ['keywords', 'license', 'files']
    // 调用方法获取用户的git信息
    const { name = '', email = '' } = await getGitUser()

    // 读取package.json文件内容
    const jsonData = fs.readJsonSync(pkgPath)
    // 移除不需要的字段
    unnecessaryKey.forEach(key => delete jsonData[key])
    // 合并我们需要的信息
    Object.assign(jsonData, {
      // 以初始化的项目名称作为name
      name: this.source,
      // author字段更新成我们git上的name
      author: name && email ? `${name} ${email}` : '',
      // 设置非私有
      provide: true,
      // 默认设置版本号1.0.0
      version: '1.0.0'
    })
    // 将更新后的package.json数据写入到package.json文件中去
    await fs.writeJsonSync(pkgPath, jsonData, { spaces: '\t' })
    // 停止菊花
    this.spinner.succeed('package.json更新完成！')
  }

  // 初始化 git 文件
  async initGit () {
    // 菊花转起来
    this.spinner.start('正在初始化Git管理项目...')
    // 调用子进程，运行 cd xxx 的命令进入到我们目标文件目录
    await runCmd(`cd ${this.RepoMaps.target}`)

    // 调用 process.chdir 方法，把 node 进程的执行位置变更到目标目录
    // 这步很重要，不然会执行失败（因为执行位置不对）
    process.chdir(this.RepoMaps.target)

    // 调用子进程执行 git init 命令，辅助我们进行 git 初始化
    await runCmd(`git init`)
    // 菊花停下来
    this.spinner.succeed('Git初始化完成！')
  }

  // 安装依赖
  async runApp () {
    try {
      this.spinner.start('正在安装项目依赖文件，请稍后...')
      await runCmd(`npm install --registry=https://registry.npm.taobao.org`)
      await runCmd(`git add . && git commit -m"init: 初始化项目基本框架"`)
      this.spinner.succeed('依赖安装完成！')

      console.log('请运行如下命令启动项目吧：\n')
      log.success(`   cd ${this.source}`)
      log.success(`   npm run serve`)
    } catch (error) {
      console.log('项目安装失败，请运行如下命令手动安装：\n')
      log.success(`   cd ${this.source}`)
      log.success(`   npm run install`)
    }
  }
}

module.exports = Creator
