const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const fsPromises = require('fs').promises
const XLSX = require('xlsx')

// 添加全局变量存储主窗口
let mainWindow = null;
let loadingWindow = null;
let db = require('./db');

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 300,
    height: 200,
    frame: false,
    transparent: true,
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  loadingWindow.loadFile('src/loading.html');
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,  // 初始时不显示主窗口
    frame: false, // 取消默认边框
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true,
      webSecurity: false,
      enableRemoteModule: true,
      additionalArguments: ['--enable-features=PrintPreview'],
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/index.html')
    .then(() => {
      mainWindow.show();
      if (loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
      }
    })
    .catch(err => {
      console.error('页面加载失败:', err);
    });
}

app.whenReady().then(async () => {
  try {
    await setupAutoBackup();  // 初始化自动备份
    createLoadingWindow();    // 创建加载窗口
    createWindow();          // 创建主窗口
    scheduleRecurringTransactions();
  } catch (error) {
    console.error('应用初始化失败:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

// 添加 IPC 通信处理
ipcMain.handle('add-transaction', async (event, data) => {
    try {
        const id = await db.addTransaction(data);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-transactions', async (event, filters) => {
    try {
        const transactions = await db.getTransactions(filters);
        return { success: true, data: transactions };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-monthly-stats', async (event, year, month) => {
    try {
        const stats = await db.getMonthlyStats(year, month);
        return { success: true, data: stats };
    } catch (error) {
        console.error('获取月度统计失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('set-budget', async (event, data) => {
    try {
        const id = await db.setBudget(data);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-budget', async (event, month) => {
    try {
        const budgets = await db.getBudgets(month);
        return { success: true, data: budgets };
    } catch (error) {
        console.error('获取预算失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-transaction', async (event, { id, data }) => {
    try {
        const changes = await db.updateTransaction(id, data);
        return { success: true, changes };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-transaction', async (event, id) => {
    try {
        const changes = await db.deleteTransaction(id);
        return { success: true, changes };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-budget', async (event, id) => {
    try {
        const changes = await db.deleteBudget(id);
        return { success: true, changes };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-category-expenses', async (event, month) => {
    try {
        const expenses = await db.getCategoryExpenses(month);
        return { success: true, data: expenses };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-monthly-trend', async (event, year) => {
    try {
        const data = await db.getMonthlyTrend(year);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-category-stats', async (event, year, month) => {
    try {
        const stats = await db.getCategoryStats(year, month);
        return { success: true, data: stats };
    } catch (error) {
        console.error('获取分类统计失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-spending-habits', async (event, months) => {
    try {
        const data = await db.getSpendingHabits(months);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-yearly-report', async (event, year) => {
    try {
        const data = await db.getYearlyReport(year);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-category-summary', async (event, startDate, endDate) => {
    try {
        const data = await db.getCategorySummary(startDate, endDate);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 修改 PDF 导出处理函数
ipcMain.handle('print-to-pdf', async (event) => {
    try {
        const currentDate = new Date();
        const fileName = `财务报表_${currentDate.getFullYear()}.pdf`;
        const filePath = path.join(app.getPath('downloads'), fileName);
        
        // 创建一个临时窗口来生成 PDF
        const printWindow = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        // 从发送事件的窗口获取 HTML 内容
        const htmlContent = await event.sender.executeJavaScript(`
            document.querySelector('.print-content').outerHTML
        `);

        // 在临时窗口中加载内容
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        padding: 40px;
                        font-family: Arial, sans-serif;
                    }
                    @media print {
                        body {
                            padding: 20px;
                        }
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `)}`);

        // 等待内容加载完成
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 生成 PDF
        const data = await printWindow.webContents.printToPDF({
            marginsType: 1,
            pageSize: 'A4',
            printBackground: true,
            landscape: false
        });

        // 关闭临时窗口
        printWindow.close();

        // 写入文件
        await fsPromises.writeFile(filePath, data);
        
        // 打开文件所在文件夹
        require('electron').shell.showItemInFolder(filePath);
        
        return { success: true, filePath };
    } catch (error) {
        console.error('PDF导出失败:', error);
        return { success: false, error: error.message };
    }
});

// 备份数据处理
ipcMain.handle('backup-data', async () => {
    try {
        const now = new Date();
        const defaultFilename = `财务数据备份_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.db`;

        const result = await dialog.showSaveDialog({
            title: '保存备份文件',
            defaultPath: path.join(app.getPath('downloads'), defaultFilename),
            filters: [
                { name: '数据库文件', extensions: ['db'] }
            ],
            properties: ['showOverwriteConfirmation']
        });

        if (!result.canceled && result.filePath) {
            await fs.promises.copyFile(db.dbPath, result.filePath);
            return { success: true, path: result.filePath };
        }
        return { success: false, error: '用户取消了操作' };
    } catch (error) {
        console.error('备份失败:', error);
        return { success: false, error: error.message };
    }
});

// 恢复数据处理
ipcMain.handle('restore-data', async () => {
    try {
        const result = await dialog.showOpenDialog({
            title: '选择备份文件',
            filters: [
                { name: '数据库文件', extensions: ['db'] }
            ],
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const backupPath = result.filePaths[0];

            // 关闭数据库连接
            await new Promise((resolve, reject) => {
                db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 备份当前数据库（以防恢复失败）
            const tempBackup = `${db.dbPath}.temp`;
            await fs.promises.copyFile(db.dbPath, tempBackup);

            try {
                // 恢复备份
                await fs.promises.copyFile(backupPath, db.dbPath);
                
                // 重新初始化数据库
                delete require.cache[require.resolve('./db')];
                db = require('./db');

                // 删除临时备份
                await fs.promises.unlink(tempBackup);

                // 重启应用
                app.relaunch();
                app.exit(0);
                
                return { success: true };
            } catch (error) {
                // 恢复失败，还原临时备份
                await fs.promises.copyFile(tempBackup, db.dbPath);
                await fs.promises.unlink(tempBackup);
                throw error;
            }
        }
        return { success: false, error: '用户取消了操作' };
    } catch (error) {
        console.error('恢复失败:', error);
        return { success: false, error: error.message };
    }
});

// 添加定期交易相关的 IPC 处理
ipcMain.handle('add-recurring-transaction', async (event, data) => {
    try {
        const id = await db.addRecurringTransaction(data);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-recurring-transactions', async () => {
    try {
        const transactions = await db.getRecurringTransactions();
        return { success: true, data: transactions };
    } catch (error) {
        console.error('获取定期交易失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-recurring-transaction', async (event, { id, data }) => {
    try {
        const changes = await db.updateRecurringTransaction(id, data);
        return { success: true, changes };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-recurring-transaction', async (event, id) => {
    try {
        const changes = await db.deleteRecurringTransaction(id);
        return { success: true, changes };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 获取单个定期交易
ipcMain.handle('get-recurring-transaction', async (event, id) => {
    try {
        const transaction = await db.getRecurringTransactions()
            .then(transactions => transactions.find(t => t.id === id));
        
        if (!transaction) {
            throw new Error('未找到定期交易');
        }
        
        return { success: true, data: transaction };
    } catch (error) {
        console.error('获取定期交易失败:', error);
        return { success: false, error: error.message };
    }
});

// 切换定期交易状态
ipcMain.handle('toggle-recurring-transaction', async (event, id, currentActive) => {
    try {
        await db.toggleRecurringTransaction(id, currentActive);
        return { success: true };
    } catch (error) {
        console.error('切换定期交易状态失败:', error);
        return { success: false, error: error.message };
    }
});

// 添加定时任务，每天检查并生成定期交易
function scheduleRecurringTransactions() {
    // 应用启动时立即执行一次
    generateRecurringTransactions();

    // 然后每24小时执行一次
    setInterval(generateRecurringTransactions, 24 * 60 * 60 * 1000);
}

// 抽取生成函数
async function generateRecurringTransactions() {
    try {
        console.log('开始执行定期交易检查...');
        const generated = await db.generateRecurringTransactions();
        if (generated.length > 0) {
            console.log('已生成定期交易:', generated);
            // 通知主窗口刷新数据
            if (mainWindow) {
                mainWindow.webContents.send('recurring-transactions-generated', generated);
            }
        }
    } catch (error) {
        console.error('生成定期交易失败:', error);
    }
}

// 添加设置相关的 IPC 处理
ipcMain.handle('save-setting', async (event, key, value) => {
    try {
        const id = await db.saveSetting(key, value);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-setting', async (event, key) => {
    try {
        const value = await db.getSetting(key);
        return { success: true, data: value };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-all-settings', async () => {
    try {
        const settings = await db.getAllSettings();
        return { success: true, data: settings };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 修改导出功能处理
ipcMain.handle('export-data', async (event, format, savePath) => {
    try {
        if (!savePath) {
            throw new Error('未选择保存位置');
        }

        // 获取所有数据，使用已有的方法
        const transactions = await db.getTransactions({});
        const budgets = await db.getAllBudgets();
        const recurringTransactions = await db.getRecurringTransactions(); // 使用 getRecurringTransactions 替代 getAllRecurringTransactions

        // 创建工作簿
        const workbook = XLSX.utils.book_new();

        // 添加交易记录表
        const transactionWs = XLSX.utils.json_to_sheet(transactions.map(t => ({
            日期: t.date,
            类型: t.type === 'income' ? '收入' : '支出',
            类别: t.category,
            金额: t.amount,
            描述: t.description || ''
        })));
        XLSX.utils.book_append_sheet(workbook, transactionWs, '交易记录');

        // 添加预算表
        const budgetWs = XLSX.utils.json_to_sheet(budgets.map(b => ({
            月份: b.month,
            类别: b.category,
            预算金额: b.amount
        })));
        XLSX.utils.book_append_sheet(workbook, budgetWs, '预算记录');

        // 添加定期交易表
        if (recurringTransactions && recurringTransactions.length > 0) {
            const recurringWs = XLSX.utils.json_to_sheet(recurringTransactions.map(r => ({
                类型: r.type === 'income' ? '收入' : '支出',
                类别: r.category,
                金额: r.amount,
                频率: r.frequency === 'monthly' ? '每月' : 
                     r.frequency === 'weekly' ? '每周' : '每年',
                开始日期: r.start_date,
                结束日期: r.end_date || '',
                状态: r.active ? '启用' : '禁用',
                描述: r.description || ''
            })));
            XLSX.utils.book_append_sheet(workbook, recurringWs, '定期交易');
        }

        // 写入文件
        XLSX.writeFile(workbook, savePath);

        return { success: true, path: savePath };
    } catch (error) {
        console.error('导出数据失败:', error);
        return { success: false, error: error.message };
    }
});

// 修改自动备份功能
async function setupAutoBackup() {
    try {
        // 获取应用程序目录和源代码目录
        const appPath = path.dirname(app.getPath('exe'));
        const srcPath = path.join(__dirname); // 源代码目录
        
        // 创建两个备份路径
        const appBackupPath = path.join(appPath, 'backups');
        const srcBackupPath = path.join(srcPath, 'backups');
        
        // 确保两个备份目录都存在
        await Promise.all([
            fsPromises.mkdir(appBackupPath, { recursive: true }),
            fsPromises.mkdir(srcBackupPath, { recursive: true })
        ]);
        
        // 确保数据库文件存在
        const dbPath = path.join(appPath, 'finance.db');
        if (!fs.existsSync(dbPath)) {
            console.error('数据库文件不存在:', dbPath);
            return;
        }
        
        console.log('自动备份已初始化:', {
            appPath,
            srcPath,
            appBackupPath,
            srcBackupPath,
            dbPath
        });

        return { appBackupPath, srcBackupPath };
    } catch (error) {
        console.error('初始化自动备份失败:', error);
        throw error;
    }
}

// 修改自动备份初始化函数
async function initAutoBackup() {
    try {
        const settings = await db.getAllSettings();
        const autoBackupEnabled = settings.find(s => s.key === 'autoBackup')?.value === 'true';
        
        if (autoBackupEnabled) {
            await setupAutoBackup();
        }
    } catch (error) {
        console.error('初始化自动备份失败:', error);
    }
}

// 添加初始化自动备份的 IPC 处理
ipcMain.handle('init-auto-backup', async () => {
    try {
        await initAutoBackup();
        return { success: true };
    } catch (error) {
        console.error('初始化自动备份失败:', error);
        return { success: false, error: error.message };
    }
});

// 修改窗口控制事件监听
ipcMain.on('window-control', async (event, command) => {
    switch (command) {
        case 'minimize':
            mainWindow.minimize();
            break;
        case 'maximize':
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
            break;
        case 'close':
            try {
                const settings = await db.getAllSettings();
                const autoBackupEnabled = settings.find(s => s.key === 'autoBackup')?.value === 'true';
                
                if (autoBackupEnabled) {
                    // 获取备份路径
                    const { appBackupPath, srcBackupPath } = await setupAutoBackup();
                    const dbPath = path.join(path.dirname(app.getPath('exe')), 'finance.db');

                    // 生成备份文件名
                    const timestamp = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}_${new Date().getHours().toString().padStart(2, '0')}${new Date().getMinutes().toString().padStart(2, '0')}${new Date().getSeconds().toString().padStart(2, '0')}`;
                    
                    // 管理两个目录的备份文件
                    for (const backupPath of [appBackupPath, srcBackupPath]) {
                        // 获取现有备份并管理数量
                        const files = await fsPromises.readdir(backupPath);
                        const backupFiles = files
                            .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
                            .sort((a, b) => b.localeCompare(a));

                        // 限制备份数量为5个
                        if (backupFiles.length >= 5) {
                            const oldestFile = path.join(backupPath, backupFiles[backupFiles.length - 1]);
                            await fsPromises.unlink(oldestFile);
                        }

                        // 创建新备份
                        const backupFile = path.join(backupPath, `backup_${timestamp}.db`);
                        await fsPromises.copyFile(dbPath, backupFile);
                    }
                }
                
                // 关闭应用
                mainWindow.close();
            } catch (error) {
                console.error('自动备份失败:', error);
                const response = await dialog.showMessageBox({
                    type: 'error',
                    title: '辉易管理系统',
                    message: '自动备份失败，是否仍要退出？',
                    detail: error.message,
                    buttons: ['取消', '仍要退出'],
                    defaultId: 0,
                    cancelId: 0
                });
                
                if (response.response === 1) {
                    mainWindow.close();
                }
            }
            break;
    }
});

// 修改清空数据的 IPC 处理
ipcMain.handle('clear-data-direct', async () => {
    try {
        await db.clearAllData();
        return { success: true };
    } catch (error) {
        console.error('清空数据失败:', error);
        return { success: false, error: error.message };
    }
});

// 添加显示保存对话框的处理
ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出 Excel 文件',
        defaultPath: options.defaultPath,
        filters: [
            { name: 'Excel 文件', extensions: ['xlsx'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    });
    
    return result.canceled ? null : result.filePath;
});

// 添加获取所有预算的处理函数
ipcMain.handle('get-all-budgets', async () => {
    try {
        const budgets = await db.getAllBudgets();
        return { success: true, data: budgets };
    } catch (error) {
        console.error('获取所有预算失败:', error);
        return { success: false, error: error.message };
    }
}); 