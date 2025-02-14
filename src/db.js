const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// 使用应用程序目录
const DB_PATH = path.join(path.dirname(app.getPath('exe')), 'finance.db');

// 修改初始化逻辑，不删除现有数据库
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('数据库连接失败:', err);
    } else {
        console.log('数据库连接成功');
        // 初始化数据库表
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    // 创建交易记录表（如果不存在）
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // 创建预算表（如果不存在）
    db.run(`CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // 创建类别表（如果不存在）
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // 创建设置表（如果不存在）
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // 创建定期交易表（如果不存在）
    db.run(`CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        frequency TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        last_generated TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // 删除货币单位设置
    db.run(`DELETE FROM settings WHERE key = 'currency'`, (err) => {
        if (err) {
            console.error('删除货币单位设置失败:', err);
        }
    });
}

// 添加数据验证函数
function validateAmount(amount) {
    const num = parseFloat(amount);
    if (isNaN(num) || !isFinite(num)) {
        throw new Error('无效的金额');
    }
    return Number(num.toFixed(2));
}

// 导出数据库操作方法
module.exports = {
    // 导出数据库路径
    get dbPath() {
        return DB_PATH;
    },

    // 导出数据库连接
    get db() {
        return db;
    },

    // 导出关闭数据库方法
    close(callback) {
        return db.close(callback);
    },

    // 添加交易记录
    addTransaction: (data) => {
        return new Promise((resolve, reject) => {
            try {
                const { type, category, amount, date, description } = data;
                const validatedAmount = validateAmount(amount);
                
                db.run(
                    `INSERT INTO transactions (type, category, amount, date, description) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [type, category, validatedAmount, date, description],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    },

    // 获取交易记录
    getTransactions: (filters = {}) => {
        return new Promise((resolve, reject) => {
            try {
                let query = 'SELECT * FROM transactions';
                const params = [];
                const conditions = [];
                
                // 构建过滤条件
                if (filters.id) {
                    conditions.push('id = ?');
                    params.push(filters.id);
                }
                if (filters.startDate) {
                    conditions.push('date >= ?');
                    params.push(filters.startDate);
                }
                if (filters.endDate) {
                    conditions.push('date <= ?');
                    params.push(filters.endDate);
                }
                if (filters.type) {
                    conditions.push('type = ?');
                    params.push(filters.type);
                }
                if (filters.category) {
                    conditions.push('category = ?');
                    params.push(filters.category);
                }
                
                // 添加 WHERE 子句
                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }
                
                // 添加排序
                query += ` ORDER BY ${filters.orderBy || 'date'} ${filters.orderDirection || 'DESC'}`;
                
                // 添加限制
                if (filters.limit) {
                    query += ' LIMIT ?';
                    params.push(filters.limit);
                }
                
                console.log('执行查询:', query, params);
                
                db.all(query, params, (err, rows) => {
                    if (err) {
                        console.error('查询失败:', err);
                        reject(err);
                    } else {
                        console.log('查询结果:', rows);
                        resolve(rows);
                    }
                });
            } catch (error) {
                console.error('查询出错:', error);
                reject(error);
            }
        });
    },

    // 获取月度统计
    getMonthlyStats: (year, month) => {
        return new Promise((resolve, reject) => {
            try {
                // 确保参数是有效的
                if (!year || !month) {
                    console.error('无效的参数:', { year, month });
                    throw new Error('无效的年份或月份');
                }

                // 确保参数是数字类型
                const numYear = parseInt(year);
                const numMonth = parseInt(month);

                // 修改日期范围计算方式
                const startDate = new Date(numYear, numMonth - 1, 1)
                    .toISOString().slice(0, 10);
                const endDate = new Date(numYear, numMonth, 0)
                    .toISOString().slice(0, 10);

                console.log('查询日期范围:', { startDate, endDate });

                // 执行查询
                db.all(`
                    SELECT 
                        type,
                        ROUND(SUM(amount), 2) as total
                    FROM transactions 
                    WHERE date BETWEEN ? AND ?
                    GROUP BY type
                `, [startDate, endDate], (err, rows) => {
                    if (err) {
                        console.error('查询出错:', err);
                        reject(err);
                    } else {
                        console.log('查询结果:', rows);
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('获取月度统计失败:', error);
                reject(error);
            }
        });
    },

    // 设置预算
    setBudget: (data) => {
        return new Promise((resolve, reject) => {
            const { category, amount, month } = data;
            
            // 先检查是否已存在该月份和类别的预算
            db.get(
                `SELECT id FROM budgets WHERE month = ? AND category = ?`,
                [month, category],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // 如果存在则更新，不存在则插入
                    const query = row ? 
                        `UPDATE budgets SET amount = ? WHERE month = ? AND category = ?` :
                        `INSERT INTO budgets (amount, month, category) VALUES (?, ?, ?)`;
                    
                    const params = [amount, month, category];

                    db.run(query, params, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            // 返回现有记录的ID或新插入记录的ID
                            resolve(row ? row.id : this.lastID);
                        }
                    });
                }
            );
        });
    },

    // 获取预算
    getBudget: (monthOrId) => {
        return new Promise((resolve, reject) => {
            try {
                const isId = typeof monthOrId === 'number' || /^\d+$/.test(monthOrId);
                const query = isId ? 
                    'SELECT * FROM budgets WHERE id = ?' : 
                    'SELECT * FROM budgets WHERE month = ?';
                
                console.log('获取预算:', { monthOrId, isId, query });
                
                db.all(query, [isId ? parseInt(monthOrId) : monthOrId], (err, rows) => {
                    if (err) {
                        console.error('查询预算失败:', err);
                        reject(err);
                    } else {
                        console.log('预算查询结果:', rows);
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('获取预算失败:', error);
                reject(error);
            }
        });
    },

    // 更新交易记录
    updateTransaction: (id, data) => {
        return new Promise((resolve, reject) => {
            const { type, category, amount, date, description } = data;
            db.run(
                `UPDATE transactions 
                 SET type = ?, category = ?, amount = ?, date = ?, description = ?
                 WHERE id = ?`,
                [type, category, amount, date, description, id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    // 删除交易记录
    deleteTransaction: (id) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM transactions WHERE id = ?',
                [id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    // 删除预算
    deleteBudget: (id) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM budgets WHERE id = ?',
                [id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    // 获取指定月份的分类支出统计
    getCategoryExpenses: (month) => {
        return new Promise((resolve, reject) => {
            try {
                // 确保月份格式正确
                if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                    throw new Error('无效的月份格式');
                }

                // 修改查询，只获取已设置预算的类别的支出
                db.all(`
                    SELECT 
                        t.category,
                        ROUND(SUM(t.amount), 2) as total
                    FROM transactions t
                    INNER JOIN budgets b ON t.category = b.category
                    WHERE t.type = 'expense'
                    AND strftime('%Y-%m', t.date) = ?
                    AND b.month = ?
                    GROUP BY t.category
                    ORDER BY total DESC
                `, [month, month], (err, rows) => {
                    if (err) {
                        console.error('查询分类支出失败:', err);
                        reject(err);
                    } else {
                        console.log('分类支出查询结果:', rows);
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('获取分类支出失败:', error);
                reject(error);
            }
        });
    },

    // 获取月度支出趋势
    getMonthlyTrend: (year) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    strftime('%m', date) as month,
                    type,
                    SUM(amount) as total
                 FROM transactions 
                 WHERE strftime('%Y', date) = ?
                 GROUP BY strftime('%m', date), type
                 ORDER BY month`,
                [year],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 获取支出分类统计
    getCategoryStats: (year, month) => {
        return new Promise((resolve, reject) => {
            try {
                // 确保参数是有效的
                if (!year || !month) {
                    throw new Error('无效的年份或月份');
                }

                // 确保参数是数字类型
                const numYear = parseInt(year);
                const numMonth = parseInt(month);

                // 构建日期范围
                const startDate = `${numYear}-${numMonth.toString().padStart(2, '0')}-01`;
                const endDate = new Date(numYear, numMonth, 0).toISOString().slice(0, 10);

                console.log('查询分类统计范围:', { startDate, endDate });

                // 执行查询
                db.all(`
                    SELECT 
                        type,
                        category,
                        COUNT(*) as count,
                        SUM(amount) as total
                    FROM transactions 
                    WHERE date BETWEEN ? AND ?
                    GROUP BY type, category
                    ORDER BY type, total DESC
                `, [startDate, endDate], (err, rows) => {
                    if (err) {
                        console.error('查询分类统计失败:', err);
                        reject(err);
                    } else {
                        console.log('分类统计结果:', rows);
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('获取分类统计失败:', error);
                reject(error);
            }
        });
    },

    // 获取消费习惯分析
    getSpendingHabits: (months = 3) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    category,
                    COUNT(*) as frequency,
                    SUM(amount) as total,
                    AVG(amount) as average_amount,
                    MIN(amount) as min_amount,
                    MAX(amount) as max_amount
                 FROM transactions 
                 WHERE type = 'expense'
                 AND date >= date('now', ?)
                 GROUP BY category
                 ORDER BY frequency DESC`,
                [`-${months} months`],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 获取年度收支报表
    getYearlyReport: (year) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    strftime('%m', date) as month,
                    type,
                    category,
                    SUM(amount) as total,
                    COUNT(*) as count
                 FROM transactions 
                 WHERE strftime('%Y', date) = ?
                 GROUP BY strftime('%m', date), type, category
                 ORDER BY month`,
                [year],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 获取月度对比数据
    getMonthlyComparison: (startMonth, endMonth) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    strftime('%Y-%m', date) as month,
                    type,
                    SUM(amount) as total
                 FROM transactions 
                 WHERE strftime('%Y-%m', date) BETWEEN ? AND ?
                 GROUP BY strftime('%Y-%m', date), type
                 ORDER BY month`,
                [startMonth, endMonth],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 获取分类汇总报表
    getCategorySummary: (startDate, endDate) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    type,
                    category,
                    COUNT(*) as count,
                    SUM(amount) as total,
                    AVG(amount) as average,
                    MIN(amount) as min_amount,
                    MAX(amount) as max_amount
                 FROM transactions 
                 WHERE date BETWEEN ? AND ?
                 GROUP BY type, category
                 ORDER BY type, total DESC`,
                [startDate, endDate],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 保存设置
    saveSetting: (key, value) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO settings (key, value, updated_at) 
                 VALUES (?, ?, CURRENT_TIMESTAMP)`,
                [key, value],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    // 获取设置
    getSetting: (key) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT value FROM settings WHERE key = ?',
                [key],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.value);
                }
            );
        });
    },

    // 获取所有设置
    getAllSettings: () => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT key, value FROM settings',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 添加定期交易
    addRecurringTransaction: (data) => {
        return new Promise((resolve, reject) => {
            const { type, category, amount, frequency, start_date, end_date, description, active } = data;
            db.run(
                `INSERT INTO recurring_transactions 
                 (type, category, amount, frequency, start_date, end_date, description, active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [type, category, amount, frequency, start_date, end_date, description, active],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    // 获取定期交易列表
    getRecurringTransactions: () => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM recurring_transactions ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 更新定期交易
    updateRecurringTransaction: (id, data) => {
        return new Promise((resolve, reject) => {
            const { type, category, amount, frequency, start_date, end_date, description, active } = data;
            db.run(
                `UPDATE recurring_transactions 
                 SET type = ?, category = ?, amount = ?, frequency = ?, 
                     start_date = ?, end_date = ?, description = ?, active = ?
                 WHERE id = ?`,
                [type, category, amount, frequency, start_date, end_date, description, active, id],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    },

    // 删除定期交易
    deleteRecurringTransaction: (id) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM recurring_transactions WHERE id = ?',
                [id],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    },

    // 切换定期交易状态
    toggleRecurringTransaction: (id, active) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE recurring_transactions SET active = ? WHERE id = ?',
                [active ? 0 : 1, id],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    },

    // 生成定期交易
    generateRecurringTransactions: () => {
        return new Promise(async (resolve, reject) => {
            try {
                const today = new Date().toISOString().slice(0, 10);
                console.log('开始检查定期交易，当前日期:', today);

                // 获取需要生成的定期交易
                const recurring = await new Promise((resolve, reject) => {
                    db.all(
                        `SELECT * FROM recurring_transactions 
                         WHERE active = 1 
                         AND (end_date IS NULL OR end_date >= ?)
                         AND (last_generated IS NULL OR last_generated < ?)`,
                        [today, today],
                        (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        }
                    );
                });

                console.log('找到待处理的定期交易:', recurring);

                const generated = [];
                for (const r of recurring) {
                    // 根据频率计算下一次交易日期
                    let nextDate = r.last_generated ? 
                        module.exports.calculateNextDate(r.last_generated, r.frequency) :
                        r.start_date;

                    console.log('计算下一次交易日期:', {
                        id: r.id,
                        lastGenerated: r.last_generated,
                        frequency: r.frequency,
                        nextDate: nextDate
                    });

                    // 如果下一次日期已到，生成交易记录
                    if (nextDate <= today) {
                        console.log('生成新交易:', {
                            id: r.id,
                            type: r.type,
                            category: r.category,
                            amount: r.amount,
                            date: nextDate
                        });

                        const transaction = {
                            type: r.type,
                            category: r.category,
                            amount: r.amount,
                            date: nextDate,
                            description: r.description
                        };

                        const id = await module.exports.addTransaction(transaction);
                        generated.push({ id, ...transaction });

                        // 更新最后生成日期
                        await new Promise((resolve, reject) => {
                            db.run(
                                'UPDATE recurring_transactions SET last_generated = ? WHERE id = ?',
                                [nextDate, r.id],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });

                        console.log('交易已生成，ID:', id);
                    } else {
                        console.log('还未到生成时间:', {
                            id: r.id,
                            nextDate: nextDate,
                            today: today
                        });
                    }
                }

                console.log('定期交易生成完成，共生成:', generated.length);
                resolve(generated);
            } catch (error) {
                console.error('生成定期交易时出错:', error);
                reject(error);
            }
        });
    },

    // 辅助函数：计算下一次交易日期
    calculateNextDate: (lastDate, frequency) => {
        const date = new Date(lastDate);
        switch (frequency) {
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
        }
        return date.toISOString().slice(0, 10);
    },

    // 获取所有预算
    getAllBudgets: () => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM budgets ORDER BY month DESC',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 获取指定月份的预算
    getBudgets: (month) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM budgets WHERE month = ?',
                [month],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // 添加清空所有数据的方法
    clearAllData: () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                try {
                    // 清空所有表的数据
                    db.run('DELETE FROM transactions');
                    db.run('DELETE FROM budgets');
                    db.run('DELETE FROM recurring_transactions');
                    // 重置自增ID
                    db.run('DELETE FROM sqlite_sequence');
                    // 保留设置表中的数据
                    db.run('COMMIT');
                    resolve();
                } catch (error) {
                    db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    },
};