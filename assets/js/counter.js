/**
 * counter.js - 不蒜子 (Busuanzi) 阅读量显示
 * 
 * 在文章页面的作者信息旁动态注入阅读量标签。
 * 不蒜子脚本加载完成后会自动填充 #busuanzi_value_page_pv 的值。
 */
(function () {
    // 仅在文章页面生效（检测 .writer-info 元素是否存在）
    var writerInfo = document.querySelector('.writer-info');
    if (writerInfo) {
        var span = document.createElement('span');
        span.style.marginLeft = '15px';
        span.innerHTML = '阅读量: <span id="busuanzi_value_page_pv">...</span>';
        writerInfo.appendChild(span);
    }
})();
