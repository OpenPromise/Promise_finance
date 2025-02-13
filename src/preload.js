const XLSX = require('xlsx');
const { ipcRenderer } = require('electron');

// 添加打印功能
window.print = (options) => {
    ipcRenderer.invoke('print-to-pdf', options);
};

// 将 ipcRenderer 暴露到 window 对象
window.XLSX = XLSX;
window.ipcRenderer = ipcRenderer; 