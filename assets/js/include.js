/**
 * include.js - 动态加载公共 HTML 片段
 * 
 * 使用方法：在 HTML 页面中添加如下标签：
 *   <div data-include="/includes/nav.html"></div>
 *   <div data-include="/includes/footer.html"></div>
 * 
 * 然后在 <head> 中引入此脚本：
 *   <script src="/assets/js/include.js"></script>
 * 
 * 导航栏高亮：在页面 <body> 或引用标签上添加 data-nav-active 属性：
 *   <body data-nav-active="home">  （可选值: home, timeline, category, friends）
 */

(function () {
    // 加载所有 data-include 元素
    function loadIncludes() {
        var elements = document.querySelectorAll('[data-include]');
        var promises = [];

        elements.forEach(function (el) {
            var url = el.getAttribute('data-include');
            var promise = fetch(url)
                .then(function (response) {
                    if (!response.ok) throw new Error('Failed to load ' + url);
                    return response.text();
                })
                .then(function (html) {
                    el.outerHTML = html;
                })
                .catch(function (err) {
                    console.error(err);
                });
            promises.push(promise);
        });

        return Promise.all(promises);
    }

    // 设置导航栏高亮
    function setActiveNav() {
        var activeKey = document.body.getAttribute('data-nav-active');
        if (!activeKey) {
            // 自动从 URL 推断
            var path = window.location.pathname;
            if (path.indexOf('/pages/home.html') !== -1 || path === '/') activeKey = 'home';
            else if (path.indexOf('/pages/timeline.html') !== -1) activeKey = 'timeline';
            else if (path.indexOf('/pages/category.html') !== -1 || path.indexOf('/Category/') !== -1) activeKey = 'category';
            else if (path.indexOf('/pages/friends.html') !== -1) activeKey = 'friends';
        }

        if (activeKey) {
            var navLinks = document.querySelectorAll('[data-nav="' + activeKey + '"]');
            navLinks.forEach(function (link) {
                link.id = 'active';
            });
        }
    }

    // 执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            loadIncludes().then(setActiveNav);
        });
    } else {
        loadIncludes().then(setActiveNav);
    }
})();
