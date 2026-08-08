// 给 home.wxml 追加签到成功弹层（避开 edit 工具的编码匹配问题）
const fs = require('fs');
const p = 'D:/clawd_workspace/projects/moonlit-treehouse/miniprogram/pages/home/home.wxml';
const NL = String.fromCharCode(10);

let s = fs.readFileSync(p, 'utf8');

if (s.indexOf('showCheckinResult') >= 0) {
  console.log('弹层已存在，跳过');
  process.exit(0);
}

const modal = [
  '',
  '  <!-- 签到成功弹层 -->',
  '  <view class="mask" wx:if="{{showCheckinResult}}" bindtap="onCloseCheckinResult">',
  '    <view class="result-card" catchtap="noop">',
  '      <view class="result-icon">🌙</view>',
  '      <view class="result-streak">连续 {{checkinResult.streakDays}} 晚</view>',
  '      <view class="result-encourage">{{checkinResult.encourage}}</view>',
  '      <view class="result-coin">月光币 +{{checkinResult.coinReward}}</view>',
  '',
  '      <view class="result-medals" wx:if="{{checkinResult.newMedals.length > 0}}">',
  '        <view class="result-medals-title">新勋章解锁！</view>',
  '        <view class="result-medal" wx:for="{{checkinResult.newMedals}}" wx:key="code">🏅 {{item.name}}</view>',
  '      </view>',
  '',
  '      <view class="result-next text-muted">明天签到可得 {{checkinResult.nextReward}} 月光币</view>',
  '      <view class="result-close" bindtap="onCloseCheckinResult">知道了</view>',
  '    </view>',
  '  </view>'
].join(NL);

// 在最后一个 </view> 之前插入
const idx = s.lastIndexOf('</view>');
if (idx < 0) {
  console.log('未找到根 </view>，中止');
  process.exit(1);
}
s = s.slice(0, idx) + modal + NL + s.slice(idx);
fs.writeFileSync(p, s, 'utf8');

const lines = s.split(NL);
console.log('已插入弹层。总行数: ' + lines.length);

// 校验标签配对
function count(tag) {
  const re = new RegExp('<' + tag + '[\\s>]', 'g');
  const open = (s.match(re) || []).length;
  const close = (s.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  return open + '/' + close;
}
console.log('view 开/闭: ' + count('view'));
console.log('block 开/闭: ' + count('block'));
