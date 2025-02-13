# 个人财务管理系统

一个基于 Electron 开发的跨平台桌面财务管理应用，帮助用户更好地管理个人财务。

## 🌟 功能特点

### 核心功能
- 📝 收支记录管理
- 💰 预算管理与预警
- 📊 财务报表与分析
- 🔄 定期交易自动生成
- 💾 数据导出备份与导入恢复

### 其他特性
- 🎨 现代化界面设计
- 🔒 本地数据存储，注重隐私
- 📱 响应式界面设计
- 🔔 预算超支提醒

## 🚀 快速开始

### 环境要求
- Node.js >= 14
- npm >= 6

### 安装步骤

1. 克隆仓库

bash

git clone https://github.com/OpenPromise/Promise_finance

cd Promise_finance

2. 安装依赖

bash

npm install

3. 启动应用

bash

npm start

4. 构建应用

bash

npm run build


## 🛠️ 技术栈

- **框架**: Electron 34.1.1
- 
- **数据库**: SQLite3
- 
- **图表**: Chart.js
- 
- **图标**: Material Design Icons
- 
- **构建工具**: electron-builder

## 📦 项目结构

src/
├── main.js # 主进程

├── renderer.js # 渲染进程

├── preload.js # 预加载脚本

├── db.js # 数据库操作

├── styles.css # 样式文件

├── index.html # 主界面

├── loading.html # 加载界面

└── components/ # 组件目录


## 🔧 配置说明

### 数据库配置
- 数据库文件默认存储在用户目录下
- 自动备份在backup文件夹下

### 自定义设置
- 主题切换
- 备份频率设置


## 📈 开发计划

- [ ] 多账户管理
- [ ] 移动端适配
- [ ] 云同步功能
- [ ] 预算智能建议

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m '添加一些特性'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 作者

OpenPromise - [GitHub](https://github.com/OpenPromise)

## 📞 联系方式

- 项目链接: [https://github.com/OpenPromise/Promise_finance](https://github.com/OpenPromise/Promise_finance)
- 个人邮箱: 2274711833@qq.com

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [Chart.js](https://www.chartjs.org/)
- [Material Design Icons](https://materialdesignicons.com/)



