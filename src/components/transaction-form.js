// 创建交易记录表单组件
class TransactionForm {
    constructor(transaction = null) {
        this.transaction = transaction;
        this.categories = {
            income: ['工资', '奖金', '投资', '其他收入'],
            expense: ['餐饮', '交通', '购物', '娱乐', '居住', '其他支出']
        };
    }

    render() {
        return `
            <div class="transaction-form">
                <h2>${this.transaction ? '编辑记录' : '新增记录'}</h2>
                <form id="addTransactionForm">
                    <div class="form-group">
                        <label>类型</label>
                        <select name="type" id="transactionType" required>
                            <option value="income" ${this.transaction?.type === 'income' ? 'selected' : ''}>收入</option>
                            <option value="expense" ${this.transaction?.type === 'expense' ? 'selected' : ''}>支出</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>类别</label>
                        <select name="category" id="transactionCategory" required>
                            ${(this.transaction ? this.categories[this.transaction.type] : this.categories.income)
                                .map(cat => `<option value="${cat}" ${this.transaction?.category === cat ? 'selected' : ''}>${cat}</option>`)
                                .join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>金额</label>
                        <input type="text" 
                               name="amount" 
                               required 
                               value="${this.transaction?.amount || ''}"
                               placeholder="请输入金额"
                               class="amount-input">
                    </div>
                    <div class="form-group">
                        <label>日期</label>
                        <input type="date" name="date" required value="${this.transaction?.date || ''}">
                    </div>
                    <div class="form-group">
                        <label>描述</label>
                        <textarea name="description">${this.transaction?.description || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="button button-primary">保存</button>
                        <button type="button" class="button button-secondary" onclick="closeTransactionForm()">取消</button>
                    </div>
                </form>
            </div>
        `;
    }

    init() {
        // 类型切换时更新类别选项
        document.getElementById('transactionType').addEventListener('change', (e) => {
            const categorySelect = document.getElementById('transactionCategory');
            const categories = this.categories[e.target.value];
            categorySelect.innerHTML = categories.map(cat => 
                `<option value="${cat}">${cat}</option>`
            ).join('');
        });

        // 表单提交处理
        document.getElementById('addTransactionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                type: formData.get('type'),
                category: formData.get('category'),
                amount: parseFloat(formData.get('amount')),
                date: formData.get('date'),
                description: formData.get('description')
            };

            try {
                await this.saveTransaction(data);
            } catch (error) {
                console.error('保存交易记录失败:', error);
                alert('保存失败: ' + error.message);
            }
        });

        // 简化金额输入验证
        const amountInput = document.querySelector('input[name="amount"]');
        
        // 输入时只允许数字和小数点
        amountInput.addEventListener('input', function(e) {
            let value = this.value;
            
            // 保留数字和第一个小数点
            value = value.replace(/[^\d.]/g, '');
            
            // 确保只有一个小数点
            const decimalCount = (value.match(/\./g) || []).length;
            if (decimalCount > 1) {
                const parts = value.split('.');
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            this.value = value;
        });

        // 失去焦点时格式化
        amountInput.addEventListener('blur', function() {
            let value = this.value.trim();
            if (value) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue > 0) {
                    this.value = numValue.toFixed(2);
                } else {
                    this.value = '';
                }
            }
        });
    }

    async saveTransaction(data) {
        try {
            // 1. 保存数据
            const result = this.transaction ? 
                await window.ipcRenderer.invoke('update-transaction', { id: this.transaction.id, data }) :
                await window.ipcRenderer.invoke('add-transaction', data);

            if (!result.success) {
                throw new Error(result.error || '保存失败');
            }

            // 2. 关闭表单
            closeTransactionForm();

            // 3. 直接刷新页面
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

            // 4. 等待一小段时间后刷新数据
            setTimeout(async () => {
                try {
                    await showTransactions();
                } catch (refreshError) {
                    console.error('刷新页面失败:', refreshError);
                    // 显示友好的错误信息
                    document.getElementById('content').innerHTML = `
                        <div class="header">
                            <h1>收支记录</h1>
                            <button class="button button-primary" onclick="showAddTransactionForm()">新增记录</button>
                        </div>
                        <div class="card">
                            <div class="error-message">
                                数据已保存，但页面刷新失败。
                                <button class="button" onclick="showTransactions()">重新加载</button>
                            </div>
                        </div>
                    `;
                }
            }, 100);

        } catch (error) {
            console.error('保存交易记录失败:', error);
            throw error;
        }
    }
}

module.exports = TransactionForm; 