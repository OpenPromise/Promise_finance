class RecurringTransactionForm {
    constructor(transaction = null) {
        this.transaction = transaction;
        this.isEdit = !!transaction;
    }

    render() {
        return `
            <div class="modal-backdrop"></div>
            <div class="transaction-form">
                <h2>${this.isEdit ? '编辑' : '新增'}定期交易</h2>
                <form id="recurringTransactionForm">
                    <div class="form-group">
                        <label>类型</label>
                        <select id="type" class="form-control" required>
                            <option value="expense" ${this.transaction?.type === 'expense' ? 'selected' : ''}>支出</option>
                            <option value="income" ${this.transaction?.type === 'income' ? 'selected' : ''}>收入</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>类别</label>
                        <input type="text" id="category" class="form-control" 
                               value="${this.transaction?.category || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>金额</label>
                        <input type="number" id="amount" class="form-control" step="0.01"
                               value="${this.transaction?.amount || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>频率</label>
                        <select id="frequency" class="form-control" required>
                            <option value="monthly" ${this.transaction?.frequency === 'monthly' ? 'selected' : ''}>每月</option>
                            <option value="weekly" ${this.transaction?.frequency === 'weekly' ? 'selected' : ''}>每周</option>
                            <option value="yearly" ${this.transaction?.frequency === 'yearly' ? 'selected' : ''}>每年</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>开始日期</label>
                        <input type="date" id="startDate" class="form-control"
                               value="${this.transaction?.start_date || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>结束日期（可选）</label>
                        <input type="date" id="endDate" class="form-control"
                               value="${this.transaction?.end_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>描述</label>
                        <input type="text" id="description" class="form-control"
                               value="${this.transaction?.description || ''}">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="button button-primary">保存</button>
                        <button type="button" class="button" onclick="closeRecurringTransactionForm()">取消</button>
                    </div>
                </form>
            </div>
        `;
    }

    init() {
        const form = document.getElementById('recurringTransactionForm');
        form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        try {
            const formData = {
                type: document.getElementById('type').value,
                category: document.getElementById('category').value,
                amount: parseFloat(document.getElementById('amount').value),
                frequency: document.getElementById('frequency').value,
                start_date: document.getElementById('startDate').value,
                end_date: document.getElementById('endDate').value || null,
                description: document.getElementById('description').value,
                active: 1
            };

            let result;
            if (this.isEdit) {
                result = await window.ipcRenderer.invoke('update-recurring-transaction', {
                    id: this.transaction.id,
                    data: formData
                });
            } else {
                result = await window.ipcRenderer.invoke('add-recurring-transaction', formData);
            }

            if (result.success) {
                closeRecurringTransactionForm();
                showRecurringTransactions(); // 刷新列表
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('保存定期交易失败:', error);
            alert('保存失败: ' + error.message);
        }
    }
}

module.exports = RecurringTransactionForm; 