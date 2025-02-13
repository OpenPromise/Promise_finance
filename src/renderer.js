// 激活菜单项的函数
function setActiveMenuItem(selector) {
    // 移除所有菜单项的 active 类
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    // 为当前菜单项添加 active 类
    document.querySelector(selector)?.classList.add('active');
}

async function showDashboard() {
    setActiveMenuItem('.menu-item:nth-child(1)');
    
    // 先设置基本结构
    document.getElementById('content').innerHTML = `
        <div class="header">
            <h1>仪表盘</h1>
        </div>
        <div class="dashboard-grid">
            <div class="stat-card">
                <h3>本月收入</h3>
                <div class="number">加载中...</div>
            </div>
            <div class="stat-card">
                <h3>本月支出</h3>
                <div class="number">加载中...</div>
            </div>
            <div class="stat-card">
                <h3>结余</h3>
                <div class="number">加载中...</div>
            </div>
            <div class="stat-card">
                <h3>预算完成度</h3>
                <div class="number">加载中...</div>
            </div>
        </div>
        <div class="card">
            <h2>收支趋势</h2>
            <div class="chart-container">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
        <div class="card">
            <h2>最近交易</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>类型</th>
                            <th>类别</th>
                            <th>金额</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="5" style="text-align: center;">加载中...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // 然后加载数据
    await loadDashboardData();
}

const TransactionForm = require('./components/transaction-form');
const RecurringTransactionForm = require('./components/recurring-transaction-form');

async function showTransactions() {
    try {
        setActiveMenuItem('.menu-item:nth-child(2)');
        console.log('正在获取交易记录...');
        
        // 显示加载状态
        document.getElementById('content').innerHTML = `
            <div class="header">
                <h1>收支记录</h1>
                <button class="button button-primary" onclick="showAddTransactionForm()">新增记录</button>
            </div>
            <div class="card">
                <div style="text-align: center; padding: 20px;">
                    加载中...
                </div>
            </div>
        `;
        
        if (!window.ipcRenderer) {
            throw new Error('IPC 通道未初始化');
        }
        
        // 获取交易记录数据
        const result = await window.ipcRenderer.invoke('get-transactions', {
            orderBy: 'date',
            orderDirection: 'DESC'  // 按日期降序排序，最新的在前
        });
        
        console.log('获取到的交易记录:', result);
        
        if (!result.success) {
            throw new Error(result.error || '获取数据失败');
        }
        
        const transactions = result.data;
        
        // 等待一小段时间确保 DOM 已更新
        await new Promise(resolve => setTimeout(resolve, 50));
        
    document.getElementById('content').innerHTML = `
        <div class="header">
            <h1>收支记录</h1>
                <button class="button button-primary" onclick="showAddTransactionForm()">新增记录</button>
        </div>
        <div class="card">
            <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>类型</th>
                                <th>类别</th>
                                <th>金额</th>
                                <th>描述</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.length === 0 ? 
                                '<tr><td colspan="6" style="text-align: center;">暂无记录</td></tr>' :
                                transactions.map(t => `
                                    <tr>
                                        <td>${t.date}</td>
                                        <td>${t.type === 'income' ? '收入' : '支出'}</td>
                                        <td>${t.category}</td>
                                        <td class="${t.type === 'income' ? 'income' : 'expense'}">
                                            ${t.type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                                        </td>
                                        <td>${t.description || '-'}</td>
                                        <td>
                                            <button class="button button-small" onclick="editTransaction(${t.id})">编辑</button>
                                            <button class="button button-small button-danger" onclick="deleteTransaction(${t.id})">删除</button>
                                        </td>
                                    </tr>
                                `).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('显示交易记录失败:', error);
        document.getElementById('content').innerHTML = `
            <div class="header">
                <h1>收支记录</h1>
                <button class="button button-primary" onclick="showAddTransactionForm()">新增记录</button>
            </div>
            <div class="card">
                <div class="error-message">
                    加载数据失败: ${error.message}
                    <button class="button" onclick="showTransactions()">重试</button>
            </div>
        </div>
    `;
    }
}

function showAddTransactionForm() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    const formContainer = document.createElement('div');
    const transactionForm = new TransactionForm();
    formContainer.innerHTML = transactionForm.render();
    document.body.appendChild(formContainer);
    
    transactionForm.init();
}

function closeTransactionForm() {
    document.querySelector('.modal-backdrop')?.remove();
    document.querySelector('.transaction-form')?.parentElement.remove();
}

const BudgetForm = require('./components/budget-form');

async function showBudget() {
    try {
    setActiveMenuItem('.menu-item:nth-child(3)');
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const currentMonth = `${year}-${month.toString().padStart(2, '0')}`;
        
        // 并行获取所有需要的数据
        const [budgetResult, expensesResult, categoryExpensesResult] = await Promise.all([
            window.ipcRenderer.invoke('get-budget', currentMonth),
            window.ipcRenderer.invoke('get-monthly-stats', year, month),
            window.ipcRenderer.invoke('get-category-expenses', currentMonth)
        ]);

        console.log('预算数据:', budgetResult);
        console.log('支出数据:', expensesResult);
        console.log('分类支出数据:', categoryExpensesResult);

        // 获取预算数据
        const budgets = budgetResult.success ? budgetResult.data : [];
        const hasBudget = budgets.length > 0;
        
        // 获取总支出
        const totalExpenses = expensesResult.success ? 
            (expensesResult.data.find(item => item.type === 'expense')?.total || 0) : 0;
        
        // 获取分类支出
        const categoryExpenses = categoryExpensesResult.success ? 
            categoryExpensesResult.data.reduce((acc, curr) => {
                acc[curr.category] = curr.total;
                return acc;
            }, {}) : {};

        // 计算总预算
        const totalBudget = hasBudget ? 
            budgets.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0) : 0;
        
        // 计算剩余预算和使用比例
        const remainingBudget = hasBudget ? (totalBudget - totalExpenses) : 0;
        const usagePercent = hasBudget && totalBudget > 0 ? 
            (totalExpenses / totalBudget * 100) : 0;

        // 更新界面
    document.getElementById('content').innerHTML = `
        <div class="header">
            <h1>预算管理</h1>
                <button class="button button-primary" onclick="showBudgetForm()">设置预算</button>
        </div>
        <div class="dashboard-grid">
            <div class="stat-card">
                <h3>本月预算</h3>
                    <div class="number">${hasBudget ? `¥${totalBudget.toFixed(2)}` : '未设置'}</div>
            </div>
            <div class="stat-card">
                <h3>已使用</h3>
                    <div class="number">¥${totalExpenses.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <h3>剩余预算</h3>
                    <div class="number ${hasBudget ? (remainingBudget >= 0 ? 'income' : 'expense') : ''}">
                        ${hasBudget ? `¥${remainingBudget.toFixed(2)}` : '未设置'}
                    </div>
            </div>
            <div class="stat-card">
                <h3>使用比例</h3>
                    <div class="number">${hasBudget ? `${usagePercent.toFixed(1)}%` : '0.0%'}</div>
            </div>
        </div>
        <div class="card">
            <h2>预算分类详情</h2>
                ${hasBudget ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>类别</th>
                                    <th>预算金额</th>
                                    <th>已使用</th>
                                    <th>剩余</th>
                                    <th>使用比例</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${budgets.map(b => {
                                    const categoryExpense = categoryExpenses[b.category] || 0;
                                    const remaining = parseFloat(b.amount) - categoryExpense;
                                    const usage = parseFloat(b.amount) > 0 ? (categoryExpense / parseFloat(b.amount) * 100) : 0;
                                    const progressClass = usage > 100 ? 'danger' : usage > 80 ? 'warning' : '';
                                    
                                    return `
                                        <tr>
                                            <td>${b.category}</td>
                                            <td>¥${parseFloat(b.amount).toFixed(2)}</td>
                                            <td>¥${categoryExpense.toFixed(2)}</td>
                                            <td class="${remaining >= 0 ? 'income' : 'expense'}">
                                                ¥${remaining.toFixed(2)}
                                            </td>
                                            <td>
                                                <div class="progress-bar">
                                                    <div class="progress ${progressClass}" style="width: ${Math.min(usage, 100)}%"></div>
                                                </div>
                                                ${usage.toFixed(1)}%
                                            </td>
                                            <td>
                                                <button class="button button-small" onclick="editBudget(${b.id})">编辑</button>
                                                <button class="button button-small button-danger" onclick="deleteBudget(${b.id})">删除</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>还没有设置预算，点击上方"设置预算"按钮开始规划您的支出。</p>
                    </div>
                `}
            </div>
            ${hasBudget ? `
                <div class="card">
                    <h2>预算使用趋势</h2>
            <div class="chart-container">
                <canvas id="budgetChart"></canvas>
            </div>
        </div>
            ` : ''}
    `;

        // 只在有预算数据时初始化图表
        if (hasBudget) {
            // 初始化预算图表
    const ctx = document.getElementById('budgetChart').getContext('2d');
    new Chart(ctx, {
                type: 'bar',
        data: {
                    labels: budgets.map(b => b.category),
            datasets: [{
                        label: '预算金额',
                        data: budgets.map(b => parseFloat(b.amount)),
                        backgroundColor: '#1890ff'
                    }, {
                        label: '已使用',
                        data: budgets.map(b => categoryExpenses[b.category] || 0),
                        backgroundColor: '#ff4d4f'
            }]
        },
        options: {
            responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('显示预算页面时出错:', error);
        document.getElementById('content').innerHTML = `
            <div class="header">
                <h1>预算管理</h1>
                <button class="button button-primary" onclick="showBudgetForm()">设置预算</button>
            </div>
            <div class="card">
                <div class="error-message">
                    加载数据时出错: ${error.message}
                </div>
            </div>
        `;
    }
}

function showBudgetForm(budget = null) {
    console.log('显示预算表单，预算数据:', budget);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    const formContainer = document.createElement('div');
    const budgetForm = new BudgetForm(budget);
    formContainer.innerHTML = budgetForm.render();
    document.body.appendChild(formContainer);
    
    budgetForm.init();
}

function closeBudgetForm() {
    document.querySelector('.modal-backdrop')?.remove();
    document.querySelector('.budget-form')?.parentElement.remove();
}

async function showReports() {
    try {
    setActiveMenuItem('.menu-item:nth-child(4)');
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear().toString();
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear, 11, 31);

        // 获取报表数据
        const [yearlyReport, categorySummary] = await Promise.all([
            window.ipcRenderer.invoke('get-yearly-report', currentYear),
            window.ipcRenderer.invoke('get-category-summary', 
                startDate.toISOString().slice(0, 10),
                endDate.toISOString().slice(0, 10))
        ]);

    document.getElementById('content').innerHTML = `
        <div class="header">
            <h1>财务报表</h1>
            <div class="button-group">
                    <button class="button button-primary" onclick="exportToExcel()">导出Excel</button>
                    <button class="button button-primary" onclick="exportToPDF()">导出PDF</button>
            </div>
        </div>
        <div class="card">
            <h2>年度收支概览</h2>
            <div class="chart-container">
                <canvas id="yearlyChart"></canvas>
            </div>
        </div>
        <div class="card">
                <h2>收支分类统计</h2>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>类型</th>
                                <th>类别</th>
                                <th>笔数</th>
                                <th>总金额</th>
                                <th>平均金额</th>
                                <th>最小金额</th>
                                <th>最大金额</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categorySummary.success ? 
                                categorySummary.data.map(item => `
                                    <tr>
                                        <td>${item.type === 'income' ? '收入' : '支出'}</td>
                                        <td>${item.category}</td>
                                        <td>${item.count}</td>
                                        <td class="${item.type === 'income' ? 'income' : 'expense'}">
                                            ¥${item.total.toFixed(2)}
                                        </td>
                                        <td>¥${item.average.toFixed(2)}</td>
                                        <td>¥${item.min_amount.toFixed(2)}</td>
                                        <td>¥${item.max_amount.toFixed(2)}</td>
                                    </tr>
                                `).join('') :
                                '<tr><td colspan="7" class="text-center">暂无数据</td></tr>'
                            }
                        </tbody>
                    </table>
            </div>
        </div>
    `;

    // 初始化年度收支图表
        if (yearlyReport.success) {
            initYearlyChart(yearlyReport.data);
        }

    } catch (error) {
        console.error('显示报表页面时出错:', error);
        document.getElementById('content').innerHTML = `
            <div class="header">
                <h1>财务报表</h1>
            </div>
            <div class="card">
                <div class="error-message">
                    加载数据时出错: ${error.message}
                </div>
            </div>
        `;
    }
}

// 添加图表初始化函数
function initYearlyChart(data) {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const incomeData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);

    // 处理数据
    data.forEach(item => {
        const monthIndex = parseInt(item.month) - 1;
        if (item.type === 'income') {
            incomeData[monthIndex] += item.total;
        } else {
            expenseData[monthIndex] += item.total;
        }
    });

    const ctx = document.getElementById('yearlyChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: '收入',
                data: incomeData,
                backgroundColor: '#52c41a'
            }, {
                label: '支出',
                data: expenseData,
                backgroundColor: '#ff4d4f'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function showAnalysis() {
    try {
    setActiveMenuItem('.menu-item:nth-child(5)');
        
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        // 获取统计数据
        const stats = await window.ipcRenderer.invoke('get-category-stats', year, month);
        
        if (!stats.success) {
            throw new Error(stats.error || '获取数据失败');
        }

        // 计算总收入和总支出
        let totalIncome = 0;
        let totalExpense = 0;
        stats.data.forEach(item => {
            if (item.type === 'income') {
                totalIncome += parseFloat(item.total) || 0;
            } else if (item.type === 'expense') {
                totalExpense += parseFloat(item.total) || 0;
            }
        });

        // 计算结余和收支比
        const balance = totalIncome - totalExpense;
        const ratio = totalExpense > 0 ? (totalIncome / totalExpense * 100) : 0;

        // 更新界面
    document.getElementById('content').innerHTML = `
        <div class="header">
            <h1>数据分析</h1>
                <div class="date-selector">
                    <select id="yearSelect" onchange="updateAnalysis()">
                        ${generateYearOptions(year)}
                    </select>
                    <select id="monthSelect" onchange="updateAnalysis()">
                        ${generateMonthOptions(month)}
                    </select>
                </div>
        </div>
        <div class="dashboard-grid">
            <div class="stat-card">
                    <h3>总收入</h3>
                    <div class="number income">${totalIncome.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                    <h3>总支出</h3>
                    <div class="number expense">${totalExpense.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                    <h3>结余</h3>
                    <div class="number">${balance >= 0 ? '+' : ''}${balance.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                    <h3>收支比</h3>
                    <div class="number">${ratio.toFixed(1)}%</div>
            </div>
        </div>
            <div class="analysis-grid">
        <div class="card">
                    <h2>收支分类统计</h2>
            <div class="chart-container">
                        <canvas id="categoryChart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <h2>详细统计数据</h2>
                    <div class="table-container">
                        ${generateStatsTable(stats.data)}
                    </div>
            </div>
        </div>
    `;

        // 初始化图表
        initCategoryChart(stats.data);
    } catch (error) {
        console.error('加载分析数据失败:', error);
        showError('加载分析数据失败: ' + error.message);
    }
}

// 修改生成统计表格的函数
function generateStatsTable(data) {
    if (!data || data.length === 0) {
        return '<div class="empty-state">暂无数据</div>';
    }

    const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);

    return `
        <table>
            <thead>
                <tr>
                    <th>类型</th>
                    <th>类别</th>
                    <th>总金额</th>
                    <th>占比</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(item => {
                    const total = parseFloat(item.total || 0);
                    const percentage = (total / totalAmount * 100).toFixed(1);
                    return `
                        <tr>
                            <td>${item.type === 'income' ? '收入' : '支出'}</td>
                            <td>${item.category}</td>
                            <td class="${item.type === 'income' ? 'income' : 'expense'}">
                                ${item.type === 'income' ? '+' : '-'}${Math.abs(total).toFixed(2)}
                            </td>
                            <td>${percentage}%</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// 添加编辑和删除函数
async function editTransaction(id) {
    try {
        console.log('正在获取交易记录，ID:', id);
        const result = await window.ipcRenderer.invoke('get-transactions', { id: id });
        console.log('获取到的交易记录:', result);
        
        if (result.success && result.data && result.data.length > 0) {
            const transaction = result.data[0];
            showTransactionForm(transaction);
        } else {
            console.error('未找到交易记录:', result);
            alert('获取交易记录失败: 未找到指定记录');
        }
    } catch (error) {
        console.error('编辑交易记录失败:', error);
        alert('编辑失败，请重试: ' + error.message);
    }
}

// 修改现有的 showAddTransactionForm 函数为更通用的 showTransactionForm
function showTransactionForm(transaction = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    const formContainer = document.createElement('div');
    const transactionForm = new TransactionForm(transaction);
    formContainer.innerHTML = transactionForm.render();
    document.body.appendChild(formContainer);
    
    transactionForm.init();
}

// 修改编辑预算函数
async function editBudget(id) {
    try {
        console.log('开始编辑预算，ID:', id);
        // 获取当前月份的所有预算
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const result = await window.ipcRenderer.invoke('get-budget', currentMonth);
        console.log('获取到的预算数据:', result);
        
        if (result.success && result.data) {
            // 从所有预算中找到要编辑的那一条
            const budget = result.data.find(b => b.id === id);
            if (budget) {
                showBudgetForm(budget);
            } else {
                throw new Error('未找到预算数据');
            }
        } else {
            throw new Error(result.error || '获取预算数据失败');
        }
    } catch (error) {
        console.error('编辑预算失败:', error);
        alert('编辑预算失败: ' + error.message);
    }
}

// 修改删除预算函数
async function deleteBudget(id) {
    try {
        if (!confirm('确定要删除这条预算吗？')) {
            return;
        }

        console.log('开始删除预算，ID:', id);
        // 确保 id 是数字类型
        id = parseInt(id, 10);
        if (isNaN(id)) {
            throw new Error('无效的预算ID');
        }

        const result = await window.ipcRenderer.invoke('delete-budget', id);
        console.log('删除预算结果:', result);

        if (result.success) {
            await showBudget(); // 刷新预算页面
        } else {
            throw new Error(result.error || '删除失败');
        }
    } catch (error) {
        console.error('删除预算失败:', error);
        alert('删除预算失败: ' + error.message);
    }
}

// 添加图表初始化函数
function initMonthlyTrendChart(data) {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const incomeData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);

    // 处理数据
    if (data && data.length > 0) {
        data.forEach(item => {
            const monthIndex = parseInt(item.month) - 1;
            if (item.type === 'income') {
                incomeData[monthIndex] = item.total;
            } else {
                expenseData[monthIndex] = item.total;
            }
        });
    }

    const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: '收入',
                data: incomeData,
                borderColor: '#1890ff',
                tension: 0.1
            }, {
                label: '支出',
                data: expenseData,
                borderColor: '#ff4d4f',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function initCategoryPieChart(data) {
    const colors = [
        '#1890ff', '#ff4d4f', '#52c41a', '#faad14', '#722ed1',
        '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#9254de'
    ];

    const chartData = {
        labels: [],
        values: [],
        colors: []
    };

    // 处理数据
    if (data && data.length > 0) {
        data.forEach((item, index) => {
            chartData.labels.push(item.category);
            chartData.values.push(item.total);
            chartData.colors.push(colors[index % colors.length]);
        });
    }

    const ctx = document.getElementById('categoryPieChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.labels,
            datasets: [{
                data: chartData.values,
                backgroundColor: chartData.colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// 添加导出功能
async function exportToExcel() {
    try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear().toString();
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear, 11, 31);

        // 获取所有需要导出的数据
        const [transactions, categorySummary] = await Promise.all([
            window.ipcRenderer.invoke('get-transactions', {
                startDate: startDate.toISOString().slice(0, 10),
                endDate: endDate.toISOString().slice(0, 10)
            }),
            window.ipcRenderer.invoke('get-category-summary', 
                startDate.toISOString().slice(0, 10),
                endDate.toISOString().slice(0, 10))
        ]);

        // 准备 Excel 工作表数据
        const workbook = XLSX.utils.book_new();

        // 交易记录工作表
        const transactionData = transactions.success ? transactions.data.map(t => ({
            '日期': t.date,
            '类型': t.type === 'income' ? '收入' : '支出',
            '类别': t.category,
            '金额': t.amount,
            '描述': t.description || ''
        })) : [];
        const transactionSheet = XLSX.utils.json_to_sheet(transactionData);
        XLSX.utils.book_append_sheet(workbook, transactionSheet, '交易记录');

        // 分类统计工作表
        const summaryData = categorySummary.success ? categorySummary.data.map(s => ({
            '类型': s.type === 'income' ? '收入' : '支出',
            '类别': s.category,
            '笔数': s.count,
            '总金额': s.total,
            '平均金额': s.average,
            '最小金额': s.min_amount,
            '最大金额': s.max_amount
        })) : [];
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, '分类统计');

        // 生成文件名
        const fileName = `财务报表_${currentYear}.xlsx`;

        // 保存文件
        XLSX.writeFile(workbook, fileName);

        // 使用统一的提示框样式
        await showDialog({
            type: 'info',
            title: '导出成功',
            content: `
                <div style="text-align: left;">
                    <p>Excel 文件已成功生成。</p>
                    <p style="margin-top: 8px; font-size: 13px; color: #666;">
                        文件位置：<br>
                        <span style="color: #1890ff; word-break: break-all;">${require('path').join(process.cwd(), fileName)}</span>
                    </p>
                </div>
            `,
            buttons: [{ text: '确定', type: 'primary' }]
        });

    } catch (error) {
        console.error('导出Excel失败:', error);
        await showDialog({
            type: 'danger',
            title: '导出失败',
            content: error.message,
            buttons: [{ text: '确定', type: 'primary' }]
        });
    }
}

// 修改 exportToPDF 函数
async function exportToPDF() {
    try {
        // 获取所有数据
        const transactionsResult = await window.ipcRenderer.invoke('get-transactions', {});
        const budgetsResult = await window.ipcRenderer.invoke('get-all-budgets');
        const recurringResult = await window.ipcRenderer.invoke('get-recurring-transactions');

        // 确保获取到正确的数据
        if (!transactionsResult.success || !budgetsResult.success || !recurringResult.success) {
            throw new Error('获取数据失败');
        }

        const transactions = transactionsResult.data;
        const budgets = budgetsResult.data;
        const recurringTransactions = recurringResult.data;

        // 创建一个隐藏的容器
        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.cssText = `
            position: fixed;
            left: -9999px;
            top: -9999px;
            width: 800px;
            height: auto;
            overflow: visible;
            z-index: -1;
        `;

        // 创建打印内容
        const printContent = document.createElement('div');
        printContent.className = 'print-content';
        printContent.style.cssText = `
            padding: 40px;
            font-family: Arial, sans-serif;
            color: #333;
            background: white;
            width: 100%;
            box-sizing: border-box;
        `;
        
        // 添加实际内容
        printContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="font-size: 24px; color: #1890ff; margin-bottom: 8px;">财务数据报表</h1>
                <p style="color: #666; margin: 0;">导出时间：${new Date().toLocaleString()}</p>
            </div>

            <!-- 交易记录表 -->
            <div style="margin-bottom: 40px;">
                <h2 style="font-size: 18px; color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1890ff;">
                    交易记录
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">日期</th>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">类型</th>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">类别</th>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: right; border: 1px solid #e8e8e8;">金额</th>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">描述</th>
                    </tr>
                </thead>
                <tbody>
                        ${transactions.length > 0 ? transactions.map(t => `
                            <tr>
                                <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${t.date}</td>
                                <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">
                                    <span style="color: ${t.type === 'income' ? '#52c41a' : '#ff4d4f'};">
                                        ${t.type === 'income' ? '收入' : '支出'}
                                    </span>
                            </td>
                                <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${t.category}</td>
                                <td style="padding: 12px 15px; text-align: right; border: 1px solid #e8e8e8;">
                                    <span style="color: ${t.type === 'income' ? '#52c41a' : '#ff4d4f'};">
                                        ${t.type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                                    </span>
                            </td>
                                <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${t.description || '-'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align: center; padding: 12px 15px; border: 1px solid #e8e8e8;">暂无交易记录</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- 预算记录表 -->
            <div style="margin-bottom: 40px;">
                <h2 style="font-size: 18px; color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1890ff;">
                    预算记录
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">月份</th>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">类别</th>
                            <th style="background: #f5f5f5; padding: 12px 15px; text-align: right; border: 1px solid #e8e8e8;">预算金额</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${budgets.length > 0 ? budgets.map(b => `
                            <tr>
                                <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${b.month}</td>
                                <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${b.category}</td>
                                <td style="padding: 12px 15px; text-align: right; border: 1px solid #e8e8e8;">
                                    ¥${b.amount.toFixed(2)}
                            </td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" style="text-align: center; padding: 12px 15px; border: 1px solid #e8e8e8;">暂无预算记录</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- 定期交易表 -->
            ${recurringTransactions.length > 0 ? `
                <div style="margin-bottom: 40px;">
                    <h2 style="font-size: 18px; color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1890ff;">
                        定期交易
                    </h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead>
                            <tr>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">类型</th>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">类别</th>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: right; border: 1px solid #e8e8e8;">金额</th>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">频率</th>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">开始日期</th>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">结束日期</th>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">状态</th>
                                <th style="background: #f5f5f5; padding: 12px 15px; text-align: left; border: 1px solid #e8e8e8;">描述</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recurringTransactions.map(r => `
                                <tr>
                                    <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">
                                        <span style="color: ${r.type === 'income' ? '#52c41a' : '#ff4d4f'};">
                                            ${r.type === 'income' ? '收入' : '支出'}
                                        </span>
                            </td>
                                    <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${r.category}</td>
                                    <td style="padding: 12px 15px; text-align: right; border: 1px solid #e8e8e8;">
                                        <span style="color: ${r.type === 'income' ? '#52c41a' : '#ff4d4f'};">
                                            ${r.type === 'income' ? '+' : '-'}${Math.abs(r.amount).toFixed(2)}
                                        </span>
                            </td>
                                    <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">
                                        ${r.frequency === 'monthly' ? '每月' : r.frequency === 'weekly' ? '每周' : '每年'}
                                    </td>
                                    <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${r.start_date}</td>
                                    <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${r.end_date || '-'}</td>
                                    <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${r.active ? '启用' : '禁用'}</td>
                                    <td style="padding: 12px 15px; border: 1px solid #e8e8e8;">${r.description || '-'}</td>
                        </tr>
                            `).join('')}
                </tbody>
            </table>
                </div>
            ` : ''}

            <div style="margin-top: 40px; font-size: 12px; color: #999; text-align: center;">
                <p>本报表由个人财务管理系统自动生成</p>
            </div>
        `;

        // 将打印内容添加到隐藏容器中
        hiddenContainer.appendChild(printContent);
        document.body.appendChild(hiddenContainer);

        // 使用 Electron 的打印功能
        const result = await window.ipcRenderer.invoke('print-to-pdf');

        // 清理临时元素
        document.body.removeChild(hiddenContainer);

        if (result.success) {
            await showDialog({
                type: 'info',
                title: '导出成功',
                content: `
                    <div style="text-align: left;">
                        <p>PDF 文件已成功生成。</p>
                        <p style="margin-top: 8px; font-size: 13px; color: #666;">
                            文件位置：<br>
                            <span style="color: #1890ff; word-break: break-all;">${result.filePath}</span>
                        </p>
                    </div>
                `,
                buttons: [{ text: '确定', type: 'primary' }]
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('导出PDF失败:', error);
        showDialog({
            type: 'danger',
            title: '导出失败',
            content: error.message,
            buttons: [{ text: '确定', type: 'primary' }]
        });
    }
}

// 修改定期交易相关函数
async function showRecurringTransactions() {
    try {
        setActiveMenuItem('.menu-item:nth-child(6)'); // 改为第6个菜单项

        const result = await window.ipcRenderer.invoke('get-recurring-transactions');
        const transactions = result.success ? result.data : [];

        document.getElementById('content').innerHTML = `
            <div class="header">
                <h1>定期交易</h1>
                <button class="button button-primary" onclick="showAddRecurringTransactionForm()">新增定期交易</button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>类型</th>
                                <th>类别</th>
                                <th>金额</th>
                                <th>频率</th>
                                <th>开始日期</th>
                                <th>结束日期</th>
                                <th>状态</th>
                                <th>描述</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.length === 0 ? 
                                '<tr><td colspan="9" class="text-center">暂无定期交易</td></tr>' :
                                transactions.map(t => `
                                    <tr>
                                        <td>${t.type === 'income' ? '收入' : '支出'}</td>
                                        <td>${t.category}</td>
                                        <td class="${t.type === 'income' ? 'income' : 'expense'}">
                                            ${t.type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                                        </td>
                                        <td>${formatFrequency(t.frequency)}</td>
                                        <td>${t.start_date}</td>
                                        <td>${t.end_date || '-'}</td>
                                        <td>${t.active ? '启用' : '禁用'}</td>
                                        <td>${t.description || '-'}</td>
                                        <td>
                                            <button class="button button-small" 
                                                    onclick="editRecurringTransaction(${t.id})">编辑</button>
                                            <button class="button button-small ${t.active ? 'button-warning' : 'button-primary'}" 
                                                    onclick="toggleRecurringTransaction(${t.id}, ${t.active})">
                                                ${t.active ? '禁用' : '启用'}
                                            </button>
                                            <button class="button button-small button-danger" 
                                                    onclick="deleteRecurringTransaction(${t.id})">删除</button>
                                        </td>
                                    </tr>
                                `).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('显示定期交易失败:', error);
        document.getElementById('content').innerHTML = `
            <div class="header">
                <h1>定期交易</h1>
                <button class="button button-primary" onclick="showAddRecurringTransactionForm()">新增定期交易</button>
            </div>
            <div class="card">
                <div class="error-message">
                    加载数据失败: ${error.message}
                </div>
            </div>
        `;
    }
}

function formatFrequency(frequency) {
    const map = {
        'weekly': '每周',
        'monthly': '每月',
        'yearly': '每年'
    };
    return map[frequency] || frequency;
}

// 添加表单相关函数
function showAddRecurringTransactionForm() {
    const form = new RecurringTransactionForm();
    
    const formContainer = document.createElement('div');
    formContainer.innerHTML = form.render();
    document.body.appendChild(formContainer);
    
    form.init();
}

function closeRecurringTransactionForm() {
    document.querySelector('.modal-backdrop')?.remove();
    document.querySelector('.transaction-form')?.parentElement.remove();
}

// 编辑定期交易
async function editRecurringTransaction(id) {
    try {
        const result = await window.ipcRenderer.invoke('get-recurring-transaction', id);
        if (result.success) {
            const form = new RecurringTransactionForm(result.data);
            const formContainer = document.createElement('div');
            formContainer.innerHTML = form.render();
            document.body.appendChild(formContainer);
            form.init();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('编辑定期交易失败:', error);
        alert('编辑失败: ' + error.message);
    }
}

// 删除定期交易
async function deleteRecurringTransaction(id) {
    try {
        if (!confirm('确定要删除这条定期交易吗？')) {
            return;
        }

        const result = await window.ipcRenderer.invoke('delete-recurring-transaction', id);
        if (result.success) {
            showRecurringTransactions(); // 刷新列表
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('删除定期交易失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// 切换定期交易状态
async function toggleRecurringTransaction(id, currentActive) {
    try {
        const result = await window.ipcRenderer.invoke('toggle-recurring-transaction', id, currentActive);
        if (result.success) {
            showRecurringTransactions(); // 刷新列表
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('切换定期交易状态失败:', error);
        alert('操作失败: ' + error.message);
    }
}

// 修改导出数据功能
async function exportData() {
    try {
        const confirmed = await showDialog({
            type: 'info',
            title: '导出数据',
            content: `
                <div style="text-align: left;">
                    <p>即将导出所有交易记录到 Excel 文件。</p>
                    <p style="margin-top: 8px; font-size: 13px; color: #666;">
                        <i class="mdi mdi-information" style="color: #1890ff;"></i>
                        导出内容包括：
                        <ul style="margin-top: 4px; padding-left: 20px;">
                            <li>交易记录</li>
                            <li>预算记录</li>
                            <li>定期交易设置</li>
                        </ul>
                    </p>
                </div>
            `,
            buttons: [
                { text: '取消', value: 'cancel', type: 'default' },
                { text: '导出', value: 'confirm', type: 'primary' }
            ]
        });

        if (confirmed === 'confirm') {
            // 先让用户选择保存位置
            const savePath = await window.ipcRenderer.invoke('show-save-dialog', {
                defaultPath: `财务数据_${new Date().toLocaleDateString().replace(/\//g, '')}.xlsx`
            });

            if (!savePath) {
                return; // 用户取消了保存
            }

            let loadingBackdrop;
            try {
                // 显示导出中的状态
                loadingBackdrop = document.createElement('div');
                loadingBackdrop.className = 'dialog-backdrop';
                loadingBackdrop.innerHTML = `
                    <div class="dialog-container">
                        <div class="dialog-header info">
                            <i class="mdi mdi-information"></i>
                            <h3 class="dialog-title">导出中</h3>
                        </div>
                        <div class="dialog-content">
                            <div style="text-align: center; padding: 20px;">
                                <div class="spinner" style="margin: 0 auto;"></div>
                                <p style="margin-top: 12px;">正在导出数据，请稍候...</p>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(loadingBackdrop);

                const result = await window.ipcRenderer.invoke('export-data', 'xlsx', savePath);

                // 确保移除加载对话框
                loadingBackdrop.remove();

        if (result.success) {
                    await showDialog({
                        type: 'info',
                        title: '导出成功',
                        content: `
                            <div style="text-align: left;">
                                <p>数据已成功导出到 Excel 文件。</p>
                                <p style="margin-top: 8px; font-size: 13px; color: #666;">
                                    文件位置：<br>
                                    <span style="color: #1890ff; word-break: break-all;">${result.path}</span>
                                </p>
                            </div>
                        `,
                        buttons: [{ text: '确定', type: 'primary' }]
                    });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
                // 确保在出错时也移除加载对话框
                loadingBackdrop?.remove();
                throw error;
            }
        }
    } catch (error) {
        console.error('导出数据失败:', error);
        await showDialog({
            type: 'danger',
            title: '导出失败',
            content: `
                <div style="text-align: left;">
                    <p>导出数据时发生错误：</p>
                    <p style="color: #ff4d4f; margin-top: 8px;">${error.message}</p>
                    <p style="margin-top: 12px; font-size: 13px; color: #888;">
                        <i class="mdi mdi-alert" style="color: #ff4d4f;"></i>
                        请检查是否有足够的磁盘空间，或者 Excel 文件是否被其他程序占用
                    </p>
                </div>
            `,
            buttons: [{ text: '确定', type: 'primary' }]
        });
    }
}

// 添加生成年份选项的函数
function generateYearOptions(currentYear) {
    const startYear = 2020;  // 设置一个起始年份
    let options = '';
    for (let year = currentYear; year >= startYear; year--) {
        options += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}年</option>`;
    }
    return options;
}

// 添加生成月份选项的函数
function generateMonthOptions(currentMonth) {
    let options = '';
    for (let month = 1; month <= 12; month++) {
        options += `<option value="${month}" ${month === currentMonth ? 'selected' : ''}>${month}月</option>`;
    }
    return options;
}

// 添加初始化分类图表的函数
function initCategoryChart(data) {
    if (!data || data.length === 0) return;

    const ctx = document.getElementById('categoryChart').getContext('2d');
    const chartData = {
        labels: data.map(item => `${item.category} (${item.type === 'income' ? '收入' : '支出'})`),
        datasets: [{
            data: data.map(item => Math.abs(item.total || 0)),
            backgroundColor: data.map(item => item.type === 'income' ? '#52c41a' : '#ff4d4f')
        }]
    };

    new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// 修改更新分析的函数
async function updateAnalysis() {
    try {
        const year = document.getElementById('yearSelect').value;
        const month = document.getElementById('monthSelect').value;
        
        // 使用 get-category-stats 而不是 get-monthly-stats
        const stats = await window.ipcRenderer.invoke('get-category-stats', year, month);
        
        if (!stats.success) {
            throw new Error(stats.error || '获取数据失败');
        }

        // 计算总收入和总支出
        let totalIncome = 0;
        let totalExpense = 0;
        stats.data.forEach(item => {
            if (item.type === 'income') {
                totalIncome += parseFloat(item.total) || 0;
            } else if (item.type === 'expense') {
                totalExpense += parseFloat(item.total) || 0;
            }
        });

        // 计算结余和收支比
        const balance = totalIncome - totalExpense;
        const ratio = totalExpense > 0 ? (totalIncome / totalExpense * 100) : 0;

        // 更新统计卡片
        document.querySelector('.stat-card:nth-child(1) .number').textContent = 
            `${totalIncome.toFixed(2)}`;
        document.querySelector('.stat-card:nth-child(2) .number').textContent = 
            `${totalExpense.toFixed(2)}`;
        document.querySelector('.stat-card:nth-child(3) .number').textContent = 
            `${balance.toFixed(2)}`;
        document.querySelector('.stat-card:nth-child(4) .number').textContent = 
            `${ratio.toFixed(1)}%`;
        
        // 更新表格
        document.querySelector('.table-container').innerHTML = generateStatsTable(stats.data);
        
        // 更新图表
        // 先销毁旧图表
        const oldChart = Chart.getChart('categoryChart');
        if (oldChart) {
            oldChart.destroy();
        }
        // 创建新图表
        initCategoryChart(stats.data);

    } catch (error) {
        console.error('更新分析数据失败:', error);
        alert('更新失败: ' + error.message);
    }
}

// 添加显示错误信息的函数
function showError(message) {
    document.getElementById('content').innerHTML = `
        <div class="header">
            <h1>数据分析</h1>
        </div>
        <div class="card">
            <div class="error-message">${message}</div>
        </div>
    `;
}

// 初始化显示仪表盘
document.addEventListener('DOMContentLoaded', async () => {
    await showDashboard(); // 使用 await 确保完整加载
});

// 在文件开头添加监听器
window.ipcRenderer.on('recurring-transactions-generated', (event, generated) => {
    console.log('收到新生成的定期交易:', generated);
    // 如果当前在交易记录页面，刷新列表
    if (document.querySelector('.menu-item:nth-child(2).active')) {
        showTransactions();
    }
});

// 修改系统设置页面函数
async function showSettings() {
    try {
        setActiveMenuItem('.menu-item:nth-child(7)');
        
        const settings = await window.ipcRenderer.invoke('get-all-settings');
        const currentSettings = settings.success ? settings.data : [];
        
        // 获取自动备份设置的值
        const autoBackupEnabled = currentSettings.find(s => s.key === 'autoBackup')?.value === 'true';
        
        document.getElementById('content').innerHTML = `
            <div class="header">
                <h1>系统设置</h1>
            </div>
            <div class="settings-grid">
                <div class="card">
                    <h2>数据管理</h2>
                    <div class="button-group">
                        <button class="button" onclick="backupData()">
                            <i class="mdi mdi-database-export"></i>
                            备份数据
                        </button>
                        <button class="button" onclick="restoreData()">
                            <i class="mdi mdi-database-import"></i>
                            恢复数据
                        </button>
                        <button class="button" onclick="exportData()">
                            <i class="mdi mdi-file-excel"></i>
                            导出到Excel
                        </button>
                    </div>
                    <div class="form-group" style="margin-top: 20px;">
                        <label>
                            <input type="checkbox" id="autoBackup" 
                                ${autoBackupEnabled ? 'checked' : ''}
                                onchange="saveSetting('autoBackup', this.checked)">
                            退出时自动备份数据
                        </label>
                    </div>
                    <div class="danger-zone" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ffccc7;">
                        <h3 style="color: #ff4d4f;">危险操作</h3>
                        <button class="button button-danger" onclick="clearAllData()">
                            <i class="mdi mdi-delete"></i>
                            清空所有数据
                        </button>
            </div>
        </div>
        <div class="card">
                    <h2>关于</h2>
                    <div class="about-info">
                        <p>版本：1.0.0</p>
                        <p>作者：辉易管理系统</p>
                        <p>© 2024 All Rights Reserved</p>
                    </div>
            </div>
        </div>
    `;
    } catch (error) {
        console.error('加载设置页面失败:', error);
        showError('加载设置页面失败: ' + error.message);
    }
}

// 添加辅助函数
function getSetting(settings, key) {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : null;
}

// 修改保存设置的函数
async function saveSetting(key, value) {
    try {
        const result = await window.ipcRenderer.invoke('save-setting', key, value.toString());
        if (result.success) {
            // 如果是自动备份设置，需要重新初始化自动备份
            if (key === 'autoBackup') {
                await window.ipcRenderer.invoke('init-auto-backup');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('保存设置失败:', error);
        showError('保存设置失败: ' + error.message);
    }
}

// 修改仪表盘数据加载函数
let isLoading = false;
async function loadDashboardData() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const currentMonth = `${year}-${month.toString().padStart(2, '0')}`;
        
        console.log('开始加载仪表盘数据:', { year, month, currentMonth });
        
        // 并行获取所有需要的数据
        const [monthlyStats, budgets, recentTransactions] = await Promise.all([
            window.ipcRenderer.invoke('get-monthly-stats', year, month),
            window.ipcRenderer.invoke('get-budget', currentMonth),
            window.ipcRenderer.invoke('get-transactions', { 
                limit: 5,
                orderBy: 'date',
                orderDirection: 'DESC'
            })
        ]);

        console.log('获取到的数据:', {
            monthlyStats,
            budgets,
            recentTransactions
        });

        // 处理月度统计数据
        let monthlyIncome = 0;
        let monthlyExpense = 0;
        if (monthlyStats.success && monthlyStats.data) {
            monthlyStats.data.forEach(stat => {
                if (stat.type === 'income') {
                    monthlyIncome = parseFloat(stat.total) || 0;
                } else if (stat.type === 'expense') {
                    monthlyExpense = parseFloat(stat.total) || 0;
                }
            });
        }

        // 计算结余和预算使用情况
        const balance = monthlyIncome - monthlyExpense;
        const totalBudget = budgets.success && budgets.data ? 
            budgets.data.reduce((sum, b) => sum + parseFloat(b.amount), 0) : 0;
        const budgetUsage = totalBudget > 0 ? 
            (monthlyExpense / totalBudget * 100) : 0;

        console.log('计算结果:', {
            monthlyIncome,
            monthlyExpense,
            balance,
            totalBudget,
            budgetUsage
        });

        // 更新仪表盘数据
        document.querySelector('.stat-card:nth-child(1) .number').textContent = 
            `${monthlyIncome.toFixed(2)}`;
        document.querySelector('.stat-card:nth-child(2) .number').textContent = 
            `${monthlyExpense.toFixed(2)}`;
        document.querySelector('.stat-card:nth-child(3) .number').textContent = 
            `${balance.toFixed(2)}`;
        document.querySelector('.stat-card:nth-child(4) .number').textContent = 
            `${budgetUsage.toFixed(1)}%`;

        // 更新最近交易列表
        const transactionsList = document.querySelector('.card:last-child tbody');
        if (recentTransactions.success && Array.isArray(recentTransactions.data)) {
            if (recentTransactions.data.length > 0) {
                const transactionsHtml = recentTransactions.data.map(t => `
                    <tr>
                        <td>${t.date}</td>
                        <td>${t.type === 'income' ? '收入' : '支出'}</td>
                        <td>${t.category}</td>
                        <td class="${t.type === 'income' ? 'income' : 'expense'}">
                            ${t.type === 'income' ? '+' : '-'}${Math.abs(parseFloat(t.amount)).toFixed(2)}
                        </td>
                        <td>${t.description || '-'}</td>
                    </tr>
                `).join('');
                transactionsList.innerHTML = transactionsHtml;
            } else {
                transactionsList.innerHTML = '<tr><td colspan="5" style="text-align: center;">暂无交易记录</td></tr>';
            }
        } else {
            console.error('获取最近交易失败:', recentTransactions);
            transactionsList.innerHTML = '<tr><td colspan="5" style="text-align: center;">加载失败</td></tr>';
        }

        // 更新趋势图表
        await updateTrendChart();

        // 添加预算预警检查
        if (totalBudget > 0 && monthlyExpense >= totalBudget * 0.8) {
            const warningCard = document.createElement('div');
            warningCard.className = 'card warning';
            warningCard.innerHTML = `
                <div class="warning-content">
                    <i class="mdi mdi-alert"></i>
                    <span>预算预警：本月支出已达到预算的 ${(monthlyExpense/totalBudget*100).toFixed(1)}%</span>
                </div>
            `;
            document.querySelector('.dashboard-grid').after(warningCard);
        }

    } catch (error) {
        console.error('加载仪表盘数据失败:', error);
        // 显示错误状态
        document.querySelectorAll('.stat-card .number').forEach(el => {
            el.textContent = '加载失败';
        });
        document.querySelector('.card:last-child tbody').innerHTML = 
            '<tr><td colspan="5" style="text-align: center;">加载失败</td></tr>';
    } finally {
        isLoading = false;
    }
}

// 添加趋势图表更新函数
async function updateTrendChart() {
    try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        // 获取最近6个月的数据
        const monthsData = [];
        for (let i = 5; i >= 0; i--) {
            let m = month - i;
            let y = year;
            if (m <= 0) {
                m += 12;
                y -= 1;
            }
            const stats = await window.ipcRenderer.invoke('get-monthly-stats', y, m);
            monthsData.push({
                month: `${m}月`,
                stats: stats.success ? stats.data : []
            });
        }

        // 处理数据
        const chartData = {
            labels: monthsData.map(d => d.month),
            income: monthsData.map(d => {
                const income = d.stats.find(s => s.type === 'income');
                return parseFloat(income?.total || 0);
            }),
            expense: monthsData.map(d => {
                const expense = d.stats.find(s => s.type === 'expense');
                return parseFloat(expense?.total || 0);
            })
        };

        // 更新图表
        const ctx = document.getElementById('trendChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: '收入',
                    data: chartData.income,
                    borderColor: '#52c41a',
                    tension: 0.1
                }, {
                    label: '支出',
                    data: chartData.expense,
                    borderColor: '#ff4d4f',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('更新趋势图表失败:', error);
    }
}

// 添加数据导入功能
async function importData() {
    try {
        const result = await window.ipcRenderer.invoke('import-data');
        if (result.success) {
            alert('数据导入成功');
            showDashboard(); // 刷新页面
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败: ' + error.message);
    }
}

// 添加预算预警功能
async function checkBudgetAlerts() {
    try {
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const [budgets, expenses] = await Promise.all([
            window.ipcRenderer.invoke('get-budget', currentMonth),
            window.ipcRenderer.invoke('get-monthly-stats', currentDate.getFullYear(), currentDate.getMonth() + 1)
        ]);

        if (budgets.success && expenses.success) {
            const totalExpense = expenses.data.find(s => s.type === 'expense')?.total || 0;
            const totalBudget = budgets.data.reduce((sum, b) => sum + parseFloat(b.amount), 0);
            
            if (totalExpense >= totalBudget * 0.8) {
                showNotification('预算预警', `本月支出已达到预算的${((totalExpense/totalBudget)*100).toFixed(1)}%`);
            }
        }
    } catch (error) {
        console.error('检查预算预警失败:', error);
    }
}

// 添加更多数据分析图表
async function showAdvancedAnalysis() {
    try {
        const year = document.getElementById('yearSelect').value;
        
        // 获取年度趋势数据
        const yearlyTrend = await window.ipcRenderer.invoke('get-yearly-trend', year);
        
        // 获取消费习惯分析
        const spendingHabits = await window.ipcRenderer.invoke('get-spending-habits', 6); // 最近6个月
        
        // 添加新的分析图表
        document.querySelector('.analysis-grid').innerHTML += `
            <div class="card">
                <h2>消费习惯分析</h2>
                <div class="chart-container">
                    <canvas id="habitsChart"></canvas>
                </div>
            </div>
            <div class="card">
                <h2>收支趋势预测</h2>
                <div class="chart-container">
                    <canvas id="forecastChart"></canvas>
                </div>
            </div>
        `;
        
        // 初始化新图表
        initHabitsChart(spendingHabits.data);
        initForecastChart(yearlyTrend.data);
    } catch (error) {
        console.error('加载高级分析失败:', error);
        alert('加载失败: ' + error.message);
    }
}

// 添加自定义报表功能
async function generateCustomReport(options) {
    try {
        const {startDate, endDate, types, categories} = options;
        
        const reportData = await window.ipcRenderer.invoke('generate-custom-report', {
            startDate,
            endDate,
            types,
            categories
        });
        
        // 生成报表内容
        const reportContent = generateReportHTML(reportData);
        
        // 显示报表
        document.getElementById('content').innerHTML = reportContent;
        
        // 初始化报表图表
        initReportCharts(reportData);
    } catch (error) {
        console.error('生成报表失败:', error);
        alert('生成报表失败: ' + error.message);
    }
}

// 显示添加账户表单
function showAddAccountForm() {
    const form = new AccountForm();
    const formContainer = document.createElement('div');
    formContainer.innerHTML = form.render();
    document.body.appendChild(formContainer);
    form.init();
}

// 显示编辑账户表单
async function editAccount(id) {
    try {
        const accounts = await window.ipcRenderer.invoke('get-accounts');
        const account = accounts.success ? accounts.data.find(a => a.id === id) : null;
        
        if (!account) {
            throw new Error('未找到账户信息');
        }

        const form = new AccountForm(account);
        const formContainer = document.createElement('div');
        formContainer.innerHTML = form.render();
        document.body.appendChild(formContainer);
        form.init();
    } catch (error) {
        console.error('编辑账户失败:', error);
        alert('编辑失败: ' + error.message);
    }
}

// 关闭账户表单
function closeAccountForm() {
    document.querySelector('.modal-backdrop')?.remove();
    document.querySelector('.account-form')?.parentElement.remove();
}

// 保存账户
async function saveAccount() {
    try {
        const form = document.getElementById('accountForm');
        const accountId = form.dataset.accountId;
        
        const data = {
            name: document.getElementById('accountName').value,
            type: document.getElementById('accountType').value,
            balance: parseFloat(document.getElementById('accountBalance').value)
        };

        let result;
        if (accountId) {
            // 编辑现有账户
            result = await window.ipcRenderer.invoke('update-account', {
                id: parseInt(accountId),
                data
            });
        } else {
            // 添加新账户
            result = await window.ipcRenderer.invoke('add-account', data);
        }

        if (result.success) {
            closeAccountForm();
            showAccounts(); // 刷新账户列表
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('保存账户失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 删除账户
async function deleteAccount(id) {
    try {
        if (!confirm('确定要删除这个账户吗？删除后无法恢复。')) {
            return;
        }

        const result = await window.ipcRenderer.invoke('delete-account', id);
        if (result.success) {
            showAccounts(); // 刷新账户列表
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('删除账户失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// 显示转账表单
function showTransferForm(fromAccountId) {
    // 待实现
}

// 修改窗口控制按钮事件
document.getElementById('minimizeButton').addEventListener('click', () => {
    window.ipcRenderer.send('window-control', 'minimize');
});

document.getElementById('maximizeButton').addEventListener('click', () => {
    window.ipcRenderer.send('window-control', 'maximize');
});

document.getElementById('closeButton').addEventListener('click', async () => {
    const confirmed = await showDialog({
        type: 'warning',
        title: '退出应用',
        content: `
            <div style="text-align: left;">
                <p>确定要退出应用吗？</p>
                <p style="margin-top: 8px; font-size: 13px; color: #888;">
                    <i class="mdi mdi-information" style="color: #1890ff;"></i>
                    系统将在退出前自动备份您的数据
                </p>
            </div>
        `,
        buttons: [
            { 
                text: '取消',
                value: 'cancel',
                type: 'default'
            },
            { 
                text: '退出',
                value: 'confirm',
                type: 'primary'
            }
        ]
    });

    if (confirmed === 'confirm') {
    window.ipcRenderer.send('window-control', 'close');
    }
});

// 修改清空数据的函数
async function clearAllData() {
    const confirmed = await showDialog({
        type: 'danger',
        title: '清空数据',
        content: `
            <div style="text-align: left;">
                <p>确定要清空所有数据吗？</p>
                <p style="margin-top: 12px; font-size: 13px; color: #ff4d4f;">
                    <i class="mdi mdi-alert-circle"></i>
                    此操作将删除所有交易记录、预算设置等数据，且不可恢复！
                </p>
            </div>
        `,
        buttons: [
            { text: '取消', value: 'cancel', type: 'default' },
            { text: '确定清空', value: 'confirm', type: 'danger' }
        ]
    });
    
    if (confirmed === 'confirm') {
        try {
            const result = await window.ipcRenderer.invoke('clear-data-direct');
        if (result.success) {
                await showDialog({
                    type: 'info',
                    title: '操作成功',
                    content: '数据已清空',
                    buttons: [{ text: '确定', type: 'primary' }]
                });
                showDashboard();
            } else {
                throw new Error(result.error);
        }
    } catch (error) {
        console.error('清空数据失败:', error);
            showDialog({
                type: 'danger',
                title: '清空失败',
                content: error.message,
                buttons: [{ text: '确定', type: 'primary' }]
            });
        }
    }
}

// 修改备份数据功能
async function backupData() {
    try {
        const result = await window.ipcRenderer.invoke('backup-data');
        if (result.success) {
            await showDialog({
                type: 'info',
                title: '备份成功',
                content: `
                    <div style="text-align: left;">
                        <p>数据已成功备份。</p>
                        <p style="margin-top: 8px; font-size: 13px; color: #666;">
                            备份文件位置：<br>
                            <span style="color: #1890ff; word-break: break-all;">${result.path}</span>
                        </p>
                        <p style="margin-top: 12px; font-size: 13px; color: #888;">
                            <i class="mdi mdi-information" style="color: #1890ff;"></i>
                            建议定期备份数据以确保数据安全
                        </p>
                    </div>
                `,
                buttons: [{ text: '确定', type: 'primary' }]
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('备份失败:', error);
        await showDialog({
            type: 'danger',
            title: '备份失败',
            content: `
                <div style="text-align: left;">
                    <p>备份数据时发生错误：</p>
                    <p style="color: #ff4d4f; margin-top: 8px;">${error.message}</p>
                    <p style="margin-top: 12px; font-size: 13px; color: #888;">
                        <i class="mdi mdi-alert" style="color: #ff4d4f;"></i>
                        请检查磁盘空间或权限后重试
                    </p>
                </div>
            `,
            buttons: [{ text: '确定', type: 'primary' }]
        });
    }
}

// 修改恢复数据功能
async function restoreData() {
    try {
        const confirmed = await showDialog({
            type: 'warning',
            title: '恢复数据',
            content: `
                <div style="text-align: left;">
                    <p>确定要从备份文件恢复数据吗？</p>
                    <p style="margin-top: 12px; font-size: 13px; color: #ff4d4f;">
                        <i class="mdi mdi-alert-circle"></i>
                        此操作将覆盖当前所有数据，且不可撤销！
                    </p>
                    <p style="margin-top: 8px; font-size: 13px; color: #888;">
                        <i class="mdi mdi-information" style="color: #1890ff;"></i>
                        建议在恢复之前先备份当前数据
                    </p>
                </div>
            `,
            buttons: [
                { text: '取消', value: 'cancel', type: 'default' },
                { text: '确定恢复', value: 'confirm', type: 'danger' }
            ]
        });
        
        if (confirmed === 'confirm') {
        const result = await window.ipcRenderer.invoke('restore-data');
        if (result.success) {
                await showDialog({
                    type: 'info',
                    title: '恢复成功',
                    content: `
                        <div style="text-align: left;">
                            <p>数据已成功恢复。</p>
                            <p style="margin-top: 8px; font-size: 13px; color: #888;">
                                <i class="mdi mdi-information" style="color: #1890ff;"></i>
                                应用将重新启动以完成恢复过程
                            </p>
                        </div>
                    `,
                    buttons: [{ text: '确定', type: 'primary' }]
                });
        } else {
            throw new Error(result.error);
            }
        }
    } catch (error) {
        console.error('恢复失败:', error);
        await showDialog({
            type: 'danger',
            title: '恢复失败',
            content: `
                <div style="text-align: left;">
                    <p>恢复数据时发生错误：</p>
                    <p style="color: #ff4d4f; margin-top: 8px;">${error.message}</p>
                    <p style="margin-top: 12px; font-size: 13px; color: #888;">
                        <i class="mdi mdi-alert" style="color: #ff4d4f;"></i>
                        请确保备份文件完整且可访问
                    </p>
                </div>
            `,
            buttons: [{ text: '确定', type: 'primary' }]
        });
    }
}

// 添加显示对话框的函数
function showDialog({ type = 'info', title, content, buttons }) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'dialog-backdrop';
        
        const dialog = document.createElement('div');
        dialog.className = 'dialog-container';
        
        const iconMap = {
            info: 'mdi-information',
            warning: 'mdi-alert',
            danger: 'mdi-alert-circle'
        };
        
        dialog.innerHTML = `
            <div class="dialog-header ${type}">
                <i class="mdi ${iconMap[type]}"></i>
                <h3 class="dialog-title">${title}</h3>
            </div>
            <div class="dialog-content">${content}</div>
            <div class="dialog-actions">
                ${buttons.map(btn => `
                    <button class="dialog-button ${btn.type ? 'dialog-button-' + btn.type : 'dialog-button-default'}"
                            data-value="${btn.value}">
                        ${btn.text}
                    </button>
                `).join('')}
            </div>
        `;
        
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        
        // 添加按钮点击事件
        dialog.querySelectorAll('.dialog-button').forEach(button => {
            button.addEventListener('click', () => {
                document.body.removeChild(backdrop);
                resolve(button.dataset.value);
            });
        });
    });
}

// 修改确认对话框函数
async function confirmDialog(title, content, type = 'warning') {
    const result = await showDialog({
        type,
        title,
        content,
        buttons: [
            { text: '取消', value: false },
            { text: '确定', value: true, type: type === 'danger' ? 'danger' : 'primary' }
        ]
    });
    return result === 'true';
}

// 修改现有的确认操作
async function deleteTransaction(id) {
    const confirmed = await confirmDialog(
        '删除记录',
        '确定要删除这条记录吗？',
        'danger'
    );
    
    if (!confirmed) return;
    
    try {
        const result = await window.ipcRenderer.invoke('delete-transaction', id);
        if (result.success) {
            showTransactions();
            loadDashboardData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('删除交易记录失败:', error);
        showDialog({
            type: 'danger',
            title: '删除失败',
            content: error.message,
            buttons: [{ text: '确定', type: 'primary' }]
        });
    }
}

// 添加显示通知的函数
function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// 添加更多数据分析图表
async function showAdvancedAnalysis() {
    try {
        const year = document.getElementById('yearSelect').value;
        
        // 获取年度趋势数据
        const yearlyTrend = await window.ipcRenderer.invoke('get-yearly-trend', year);
        
        // 获取消费习惯分析
        const spendingHabits = await window.ipcRenderer.invoke('get-spending-habits', 6); // 最近6个月
        
        // 添加新的分析图表
        document.querySelector('.analysis-grid').innerHTML += `
            <div class="card">
                <h2>消费习惯分析</h2>
                <div class="chart-container">
                    <canvas id="habitsChart"></canvas>
                </div>
            </div>
            <div class="card">
                <h2>收支趋势预测</h2>
                <div class="chart-container">
                    <canvas id="forecastChart"></canvas>
                </div>
            </div>
        `;
        
        // 初始化新图表
        initHabitsChart(spendingHabits.data);
        initForecastChart(yearlyTrend.data);
    } catch (error) {
        console.error('加载高级分析失败:', error);
        alert('加载失败: ' + error.message);
    }
}

// 添加自定义报表功能
async function generateCustomReport(options) {
    try {
        const {startDate, endDate, types, categories} = options;
        
        const reportData = await window.ipcRenderer.invoke('generate-custom-report', {
            startDate,
            endDate,
            types,
            categories
        });
        
        // 生成报表内容
        const reportContent = generateReportHTML(reportData);
        
        // 显示报表
        document.getElementById('content').innerHTML = reportContent;
        
        // 初始化报表图表
        initReportCharts(reportData);
    } catch (error) {
        console.error('生成报表失败:', error);
        alert('生成报表失败: ' + error.message);
    }
}

// 显示添加账户表单
function showAddAccountForm() {
    const form = new AccountForm();
    const formContainer = document.createElement('div');
    formContainer.innerHTML = form.render();
    document.body.appendChild(formContainer);
    form.init();
}

// 显示编辑账户表单
async function editAccount(id) {
    try {
        const accounts = await window.ipcRenderer.invoke('get-accounts');
        const account = accounts.success ? accounts.data.find(a => a.id === id) : null;
        
        if (!account) {
            throw new Error('未找到账户信息');
        }

        const form = new AccountForm(account);
        const formContainer = document.createElement('div');
        formContainer.innerHTML = form.render();
        document.body.appendChild(formContainer);
        form.init();
    } catch (error) {
        console.error('编辑账户失败:', error);
        alert('编辑失败: ' + error.message);
    }
}

// 关闭账户表单
function closeAccountForm() {
    document.querySelector('.modal-backdrop')?.remove();
    document.querySelector('.account-form')?.parentElement.remove();
}

// 保存账户
async function saveAccount() {
    try {
        const form = document.getElementById('accountForm');
        const accountId = form.dataset.accountId;
        
        const data = {
            name: document.getElementById('accountName').value,
            type: document.getElementById('accountType').value,
            balance: parseFloat(document.getElementById('accountBalance').value)
        };

        let result;
        if (accountId) {
            // 编辑现有账户
            result = await window.ipcRenderer.invoke('update-account', {
                id: parseInt(accountId),
                data
            });
        } else {
            // 添加新账户
            result = await window.ipcRenderer.invoke('add-account', data);
        }

        if (result.success) {
            closeAccountForm();
            showAccounts(); // 刷新账户列表
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('保存账户失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 删除账户
async function deleteAccount(id) {
    try {
        if (!confirm('确定要删除这个账户吗？删除后无法恢复。')) {
            return;
        }

        const result = await window.ipcRenderer.invoke('delete-account', id);
        if (result.success) {
            showAccounts(); // 刷新账户列表
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('删除账户失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// 显示转账表单
function showTransferForm(fromAccountId) {
    // 待实现
}

// 添加自动备份完成的提示对话框
async function showBackupCompleteDialog(backupPath) {
    await showDialog({
        type: 'info',
        title: '数据已备份',
        content: `
            <div style="text-align: left;">
                <p>您的数据已成功备份。</p>
                <p style="margin-top: 8px; font-size: 13px; color: #666;">
                    备份文件位置：<br>
                    <span style="color: #1890ff; word-break: break-all;">${backupPath}</span>
                </p>
            </div>
        `,
        buttons: [
            { 
                text: '确定',
                value: 'confirm',
                type: 'primary'
            }
        ]
    });
}

// 在文件开头添加
const maximizeButton = document.getElementById('maximizeButton');

// 添加窗口最大化状态处理
maximizeButton.addEventListener('click', () => {
    const isMaximized = window.innerWidth === screen.availWidth && window.innerHeight === screen.availHeight;
    document.body.classList.toggle('window-maximized', isMaximized);
});

// 监听窗口大小变化
window.addEventListener('resize', () => {
    const isMaximized = window.innerWidth === screen.availWidth && window.innerHeight === screen.availHeight;
    document.body.classList.toggle('window-maximized', isMaximized);
});

async function showAbout() {
    setActiveMenuItem('.menu-item:nth-child(7)');
    document.getElementById('content').innerHTML = `
        <div class="about-info">
            <h2>关于辉易管理系统</h2>
            <p>版本：1.0.0</p>
            <p>作者：辉哥</p>
            <p>© 2024 All Rights Reserved</p>
        </div>
    `;
} 