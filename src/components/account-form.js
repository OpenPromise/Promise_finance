class AccountForm {
    constructor(account = null) {
        this.account = account;
        this.isEdit = !!account;
    }

    render() {
        return `
            <div class="modal-backdrop"></div>
            <div class="modal account-form">
                <h2>${this.isEdit ? '编辑账户' : '添加账户'}</h2>
                <form id="accountForm" onsubmit="return false;">
                    <div class="form-group">
                        <label>账户名称</label>
                        <input type="text" id="accountName" class="form-control" 
                            value="${this.account?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>账户类型</label>
                        <select id="accountType" class="form-control" required>
                            <option value="cash" ${this.account?.type === 'cash' ? 'selected' : ''}>现金</option>
                            <option value="bank" ${this.account?.type === 'bank' ? 'selected' : ''}>银行卡</option>
                            <option value="alipay" ${this.account?.type === 'alipay' ? 'selected' : ''}>支付宝</option>
                            <option value="wechat" ${this.account?.type === 'wechat' ? 'selected' : ''}>微信</option>
                            <option value="other" ${this.account?.type === 'other' ? 'selected' : ''}>其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>初始余额</label>
                        <input type="number" id="accountBalance" class="form-control" 
                            value="${this.account?.balance || 0}" step="0.01" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="button" onclick="closeAccountForm()">取消</button>
                        <button type="submit" class="button button-primary" onclick="saveAccount()">
                            ${this.isEdit ? '保存' : '添加'}
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    init() {
        // 可以添加表单验证等初始化逻辑
    }
}

module.exports = AccountForm; 