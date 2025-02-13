class BudgetForm {
    constructor(budget = null) {
        this.budget = budget;
        this.categories = ['餐饮', '交通', '购物', '娱乐', '居住', '其他支出'];
    }

    render() {
        const currentMonth = new Date().toISOString().slice(0, 7);
        return `
            <div class="budget-form">
                <h2>${this.budget ? '编辑预算' : '设置预算'}</h2>
                <form id="budgetForm">
                    <div class="form-group">
                        <label>月份</label>
                        <input type="month" name="month" required value="${this.budget?.month || currentMonth}">
                    </div>
                    <div class="form-group">
                        <label>类别</label>
                        <select name="category" required>
                            ${this.categories.map(cat => 
                                `<option value="${cat}" ${this.budget?.category === cat ? 'selected' : ''}>${cat}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>预算金额</label>
                        <input type="text" 
                               name="amount" 
                               required 
                               value="${this.budget?.amount || ''}"
                               placeholder="请输入预算金额"
                               class="amount-input">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="button button-primary">保存</button>
                        <button type="button" class="button button-secondary" onclick="closeBudgetForm()">取消</button>
                    </div>
                </form>
            </div>
        `;
    }

    init() {
        // 金额输入验证
        const amountInput = document.querySelector('input[name="amount"]');
        
        amountInput.addEventListener('input', function(e) {
            let value = this.value;
            value = value.replace(/[^\d.]/g, '');
            const decimalCount = (value.match(/\./g) || []).length;
            if (decimalCount > 1) {
                const parts = value.split('.');
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            this.value = value;
        });

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

        // 表单提交处理
        document.getElementById('budgetForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                month: formData.get('month'),
                category: formData.get('category'),
                amount: parseFloat(formData.get('amount'))
            };

            try {
                // 如果是编辑模式，保持原有ID
                if (this.budget?.id) {
                    data.id = this.budget.id;
                }
                
                const result = await window.ipcRenderer.invoke('set-budget', data);
                if (result.success) {
                    closeBudgetForm();
                    showBudget(); // 刷新预算页面
                } else {
                    alert('保存失败：' + result.error);
                }
            } catch (error) {
                console.error('保存预算失败:', error);
                alert('保存失败，请重试');
            }
        });
    }
}

module.exports = BudgetForm; 