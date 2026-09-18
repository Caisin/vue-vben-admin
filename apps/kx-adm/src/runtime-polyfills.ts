// 构建 target 只转换语法；手机 WebView 缺少的运行时 API 必须在启动前补齐。
// 同时覆盖业务菜单与 Vben 页签等共享组件，避免进入布局后再次失败。
import 'core-js/actual/array/to-sorted';
import 'core-js/actual/array/to-reversed';
import 'core-js/actual/object/has-own';
