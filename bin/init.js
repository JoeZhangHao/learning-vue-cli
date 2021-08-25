#!/usr/bin/env node
console.log('Hello, my bin!')

// 导入当前根目录下的package.json文件，
// 为了获取对应的字段值，比如版本version
const package = require('../package');
// 在init.js中引入
const { Command } = require('commander');
const { CreateCommand } = require('../src/commands');

// 初始化
const program = new Command();

// 定义 version
program
.version(package.version, '-v, --version', 'display version for vta-cli')
.usage('<command> [options]')

// 定义参数
program.option('-y, --yes', 'run default action')
program.option('-f, --force', 'force all the question')

/**
 * 调用command方法，创建一个create命令,
 * 同时create命令后面必须跟一个命令参数
 * 如果你在终端运行vta create不加名称，则会报错提示用户
 */
 program.command('create <name>')
 // 定义该命令的描述
 .description('create a vta template project')
 // 为该命令指定一些参数
 // 最后我们都可以解析到这些参数，然后根据参数实现对应逻辑
 .option('-f, --force', '忽略文件夹检查，如果已存在则直接覆盖')
 /**
  * 最后定义我们的实现逻辑
  * source表示当前定义的name参数
  * destination则是终端的cmd对象，可以从中解析到我们需要的内容
  */
 .action((source, destination) => {
   /**
    * 比如我们这里把实现逻辑放在了另一个文件中去实现，
    * 方便代码解耦,
    * 因为destination参数比较杂乱，其实还是在此处先解析该参数对应再传入使用吧
    * 可以定义一个解析的工具函数
    */
   console.log('source: ', source);
   console.log('destination: ', destination);
   new CreateCommand(source, destination)
 });

 /**
 * 注意要使用program.parse()方式
 * 而不是直接在上面的链式调用之后直接xxx.parse()调用
 * 不然就会作为当前command的parse去处理了，从而help命令等都与你的预期不符合了
 */
try {
  program.parse(process.argv);
} catch (error) {
  console.log('err: ', error)
}