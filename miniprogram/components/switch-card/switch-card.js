// components/switch-card/switch-card.js
// 通用带说明的开关项。设置页用它、首页置顶用它。
Component({
  options: { multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    checked: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    showArrow: { type: Boolean, value: false },
    badge: { type: String, value: '' }   // 角标：'会员' / '新' / '未实名'
  },
  methods: {
    onTap: function () {
      if (this.data.disabled) {
        this.triggerEvent('disabledtap', {})
        return
      }
      if (this.data.showArrow) {
        this.triggerEvent('arrowtap', {})
        return
      }
      // 切换：传新值（true/false）给父
      var next = !this.data.checked
      this.triggerEvent('change', { value: next })
    }
  }
})
