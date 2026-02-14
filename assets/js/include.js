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
 * 导航栏高亮：通过 URL 自动推断，无需额外配置。
 * 
 * 页面内联脚本等待加载完成：
 *   document.addEventListener('includesReady', function() { ... });
 */

(function () {
    /**
     * 将 HTML 字符串插入到容器中，并正确执行其中的 <script> 标签
     * （innerHTML 不会执行 script，需要手动创建 script 元素）
     */
    function insertHTMLWithScripts(container, html) {
        // 创建临时容器解析 HTML
        var temp = document.createElement('div');
        temp.innerHTML = html;

        // 分离 script 和非 script 节点
        var scripts = [];
        var fragment = document.createDocumentFragment();

        while (temp.firstChild) {
            if (temp.firstChild.nodeName === 'SCRIPT') {
                scripts.push(temp.removeChild(temp.firstChild));
            } else {
                fragment.appendChild(temp.removeChild(temp.firstChild));
            }
        }

        // 先插入非 script 内容（替换 container）
        container.parentNode.insertBefore(fragment, container);
        container.parentNode.removeChild(container);

        // 按顺序加载 script
        return loadScriptsSequentially(scripts, 0);
    }

    /**
     * 按顺序加载脚本（确保依赖关系正确，如 jQuery 必须在 base.js 之前）
     */
    function loadScriptsSequentially(scripts, index) {
        if (index >= scripts.length) {
            return Promise.resolve();
        }

        return new Promise(function (resolve) {
            var oldScript = scripts[index];
            var newScript = document.createElement('script');

            // 复制属性
            for (var i = 0; i < oldScript.attributes.length; i++) {
                newScript.setAttribute(oldScript.attributes[i].name, oldScript.attributes[i].value);
            }

            if (oldScript.src) {
                // 外部脚本 — 等加载完再继续下一个
                newScript.onload = function () {
                    resolve(loadScriptsSequentially(scripts, index + 1));
                };
                newScript.onerror = function () {
                    console.error('Failed to load script: ' + oldScript.src);
                    resolve(loadScriptsSequentially(scripts, index + 1));
                };
                document.body.appendChild(newScript);
            } else {
                // 内联脚本
                newScript.textContent = oldScript.textContent;
                document.body.appendChild(newScript);
                resolve(loadScriptsSequentially(scripts, index + 1));
            }
        });
    }

    /**
     * 加载所有 data-include 元素
     */
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
                    return insertHTMLWithScripts(el, html);
                })
                .catch(function (err) {
                    console.error(err);
                });
            promises.push(promise);
        });

        return Promise.all(promises);
    }

    /**
     * 设置导航栏高亮（根据当前 URL 自动推断）
     */
    function setActiveNav() {
        var path = window.location.pathname;
        var activeKey = null;

        if (path.indexOf('/pages/home.html') !== -1 || path === '/') activeKey = 'home';
        else if (path.indexOf('/pages/timeline.html') !== -1) activeKey = 'timeline';
        else if (path.indexOf('/pages/category.html') !== -1 || path.indexOf('/Category/') !== -1) activeKey = 'category';
        else if (path.indexOf('/pages/friends.html') !== -1) activeKey = 'friends';

        if (activeKey) {
            var navLinks = document.querySelectorAll('[data-nav="' + activeKey + '"]');
            navLinks.forEach(function (link) {
                link.id = 'active';
            });
        }
    }

    // 执行
    function init() {
        loadIncludes().then(function () {
            setActiveNav();
            // 通知页面内联脚本：所有 include 已加载完毕，jQuery 等库已可用
            document.dispatchEvent(new Event('includesReady'));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
