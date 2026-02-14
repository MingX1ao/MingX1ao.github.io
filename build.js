#!/usr/bin/env node
/**
 * build.js - Markdown → HTML 构建脚本
 *
 * 将 notes 文件夹中的 .md 学习笔记按 ## 标题拆分为独立 HTML 文章页面。
 *
 * 用法：
 *   node build.js                  # 构建 build-config.json 中配置的所有课程
 *   node build.js --course BMStats # 仅构建指定 courseId 的课程
 *
 * 配置文件：build-config.json
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// ============================================================
// 配置
// ============================================================

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'build-config.json');
const ARTICLES_JSON = path.join(ROOT, 'articles.json');

// ============================================================
// MathJax 保护：在 marked 渲染前将 $...$ 和 $$...$$ 替换为占位符，
// 渲染后还原，避免 marked 破坏 LaTeX 语法
// ============================================================

function protectMath(markdown) {
    const placeholders = [];
    let idx = 0;

    // 先替换 $$...$$ (display math)
    markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
        const key = `%%MATH_DISPLAY_${idx}%%`;
        placeholders.push({ key, value: '\\[' + match.slice(2, -2) + '\\]' });
        idx++;
        return key;
    });

    // 再替换 $...$ (inline math)，注意不匹配 $$
    markdown = markdown.replace(/\$([^\$\n]+?)\$/g, (match) => {
        const key = `%%MATH_INLINE_${idx}%%`;
        placeholders.push({ key, value: '\\(' + match.slice(1, -1) + '\\)' });
        idx++;
        return key;
    });

    return { markdown, placeholders };
}

function restoreMath(html, placeholders) {
    for (const { key, value } of placeholders) {
        html = html.replace(key, value);
    }
    return html;
}

// ============================================================
// Markdown → HTML 转换
// ============================================================

function renderMarkdown(md) {
    const { markdown, placeholders } = protectMath(md);

    // 配置 marked
    marked.setOptions({
        gfm: true,
        breaks: true,
    });

    let html = marked.parse(markdown);
    html = restoreMath(html, placeholders);
    return html;
}

// ============================================================
// 从 markdown 章节内容中提取 TOC（目录）
// ============================================================

function extractToc(sectionHtml, sectionId) {
    const toc = [];
    // 匹配 h2 和 h3
    const headingRegex = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
    let match;
    let tocIdx = 1;
    while ((match = headingRegex.exec(sectionHtml)) !== null) {
        const level = parseInt(match[1]);
        const text = match[2].replace(/<[^>]+>/g, ''); // 去掉 HTML 标签
        const id = `${sectionId}.${tocIdx}`;
        toc.push({ level, text, id });
        tocIdx++;
    }
    return toc;
}

// 在 HTML 中给 h2/h3 添加锚点 id
function addAnchorsToHtml(html, sectionId) {
    let tocIdx = 1;
    html = html.replace(/<h([23])([^>]*)>/gi, (match, level, attrs) => {
        const id = `${sectionId}.${tocIdx}`;
        tocIdx++;
        return `<a name="${id}" class="md-header-anchor" id="${id}"></a>\n<h${level}${attrs}>`;
    });
    return html;
}

// 生成 TOC HTML
function renderTocHtml(toc, pageTitle) {
    if (toc.length === 0) return '';
    let html = '        <div class="toc">\n            <ul>\n';
    html += `                <li>${escapeHtml(pageTitle)}\n                    <ul>\n`;
    for (const item of toc) {
        const indent = item.level === 3 ? '                            ' : '                        ';
        html += `${indent}<li><a href="#${item.id}">${escapeHtml(item.text)}</a></li>\n`;
    }
    html += '                    </ul>\n                </li>\n            </ul>\n        </div>\n';
    return html;
}

// ============================================================
// HTML 模板
// ============================================================

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function articleTemplate(config, pageTitle, tocHtml, contentHtml, sectionId) {
    return `<!DOCTYPE html>
<html lang="zh-cmn-Hans">

<head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <meta name="HandheldFriendly" content="true">
    <meta charset="UTF-8">
    <meta name="keywords" content="${escapeHtml(config.courseName)}">
    <meta name="description" content="${escapeHtml(pageTitle)} - ${escapeHtml(config.courseName)}">
    <meta name="author" content="${escapeHtml(config.author)}">
    <title>${escapeHtml(pageTitle)}</title>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <link rel="stylesheet" href="/assets/css/global.css">
    <link rel="stylesheet" href="/assets/css/pace-theme-flash.css">
    <link rel="stylesheet" href="/assets/css/d-audio.css">
    <link rel="stylesheet" href="/assets/css/article-detail.css">
    <link rel="stylesheet" href="/assets/css/code.css">
    <link rel="stylesheet" href="/assets/css/github-markdown.css">
    <link rel="stylesheet" href="/assets/css/vditor.css">
    <link rel="stylesheet" href="/assets/css/markdown.css">
    <link rel="shortcut icon" href="/images/blog-logo.png">
    <style>
        .lazy-image {
            background: url('/images/loading.gif') no-repeat center;
            background-size: 26% 35%;
            height: 100%;
            width: 100%;
        }

        .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 10px;
        }

        @media (max-width: 767px) {
            .markdown-body {
                padding: 15px;
            }

            .markdown-body h1 {
                font-size: 1.35em;
            }

        }

        .codehilite {
            border-radius: 10px;
        }

        .article-content img {
            max-width: 100%;
        }

        #outerdiv {
            width: 100%;
            height: 100%;
            position: fixed;
            top: 0;
            left: 0;
            background: rgba(0, 0, 0, 0.3);
            display: none;
            z-index: 200;
        }
    </style>
    <!--[if lt IE 9]>
    <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
    <script src="https://oss.maxcdn.com/libs/respond.js/1.3.0/respond.min.js"></script>
    <![endif]-->
</head>
<body>
    <script src="/assets/js/include.js"></script>
    <div data-include="/includes/nav.html"></div>
${tocHtml}
    <!--主体-->
    <section class="main">
        <div class="left-box">
            <div id="outerdiv">
                <div id="innerdiv" style="position:absolute;"><img alt id="bigimg"
                        style="box-shadow: 0 0 10px rgba(0,0,0,0.38)" src="" /></div>
            </div>
            <!--文章内容-->
            <div class="article-container">
                <div class="article-content markdown-body">
                    <h1 style="margin: 10px 0">${escapeHtml(pageTitle)}</h1>
                    <div class="article-cate">
                        <a href="/Category/LearningHomepage.html">${escapeHtml(config.category)}</a>
                    </div>
                    <div class="writer-info">
                        <span style="margin: 5px 0;">作者: </span>
                        <span id="writer">${escapeHtml(config.author)}</span>
                    </div>
                    <div class="typora-export os-windows">
${contentHtml}
                    </div>    
                </div>
            </div>                                                                                                                                              
            <br>
            <br>
            <h2 id="__comments">Comments</h2>
                  <!-- Giscus comments -->
                    <script src="https://giscus.app/client.js"
                            data-repo="MingX1ao/MingX1ao.github.io"
                            data-repo-id="R_kgDOL_cJHA"
                            data-category="General"
                            data-category-id="DIC_kwDOL_cJHM4CgVLq"
                            data-mapping="pathname"
                            data-strict="0"
                            data-reactions-enabled="1"
                            data-emit-metadata="0"
                            data-input-position="bottom"
                            data-theme="light"
                            data-lang="zh-CN"
                            data-loading="lazy"
                            crossorigin="anonymous"
                            async>
                    </script>
        </div>
    </section>
    <!--尾部-->
    <div data-include="/includes/footer.html"></div>
    <script>
        document.addEventListener('includesReady', function() {
            const lazyImage = new LazyImage('.lazy-image');
        });
    </script>
</body>

</html>
`;
}

// ============================================================
// 课程主页模板
// ============================================================

function homepageTemplate(config, chapters) {
    const now = new Date();
    const dateStr = `${String(now.getFullYear()).slice(2)}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    let listHtml = '';
    for (const ch of chapters) {
        listHtml += `                <li class="detail-item">
                    <span class="date">${dateStr}</span>
                    <a href="${ch.filename}" class="title">${escapeHtml(ch.title)}</a>
                </li>
		    <br>
`;
    }

    return `<!DOCTYPE html>
<html lang="zh-cmn-Hans">
	
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <meta name="HandheldFriendly" content="true">
    <meta charset="UTF-8">
    <meta name="keywords" content="${escapeHtml(config.courseName)}">
    <meta name="description" content="${escapeHtml(config.courseName)}">
    <meta name="author" content="">
    <title>${escapeHtml(config.courseName)}</title>
    <link rel="stylesheet" href="/assets/css/global.css">
    <link rel="stylesheet" href="/assets/css/pace-theme-flash.css">
    <link rel="stylesheet" href="/assets/css/d-audio.css">
    <link rel="stylesheet" href="/assets/css/myPagination.css">
    <link rel="stylesheet" href="/assets/css/archive.css">
	<link rel="stylesheet" href="/assets/css/index.css">
    <link rel="shortcut icon" href="/images/blog-logo.png">
    <style rel="stylesheet">
        .lazy-image {
            background: url('/images/loading.gif') no-repeat center;
            background-size: 26% 35%;
            height: 100%;
            width: 100%;
        }
    </style>
    <!--[if lt IE 9]>
    <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
    <script src="https://oss.maxcdn.com/libs/respond.js/1.3.0/respond.min.js"></script>
    <![endif]-->
</head>

<body>
    <script src="/assets/js/include.js"></script>
    <div data-include="/includes/nav.html"></div>
    <!--主体-->
    <main class="big-container">
        <article class="article">
            <ul class="achieve-box">
                <li class="year">
                    ${escapeHtml(config.courseName)}
		</li>
		    <br>
		<li class="year">
		    ${escapeHtml(config.description)}
		</li>
${listHtml}
            </ul>
        </article>
    </main>
    <div data-include="/includes/footer.html"></div>
    <script type="text/javascript">
        document.addEventListener('includesReady', function() {
            // 图片懒加载
            const lazyImage = new LazyImage('.lazy-image');
        });
    </script>
</body>
</html>
`;
}

// ============================================================
// Markdown 文件拆分（按 ## 标题）
// ============================================================

function splitMarkdown(content) {
    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;
    let preamble = []; // content before first ## heading

    for (const line of lines) {
        // Match ## headings (but not ### or deeper)
        const match = line.match(/^## (.+)$/);
        if (match) {
            if (currentSection) {
                sections.push(currentSection);
            }
            currentSection = {
                rawTitle: match[1].trim(),
                lines: []
            };
        } else if (currentSection) {
            currentSection.lines.push(line);
        } else {
            preamble.push(line);
        }
    }

    if (currentSection) {
        sections.push(currentSection);
    }

    return { preamble, sections };
}

// 清除标题中的 HTML 标签（如 <font color=red>）
function cleanTitle(rawTitle) {
    return rawTitle.replace(/<[^>]+>/g, '').trim();
}

// ============================================================
// 主构建流程
// ============================================================

function buildCourse(config) {
    console.log(`\n[构建] ${config.courseName} (${config.courseId})`);
    console.log(`  源文件: ${config.source}`);

    // 读取 Markdown
    if (!fs.existsSync(config.source)) {
        console.error(`  ❌ 源文件不存在: ${config.source}`);
        return [];
    }

    const mdContent = fs.readFileSync(config.source, 'utf-8');
    const { sections } = splitMarkdown(mdContent);

    console.log(`  找到 ${sections.length} 个章节`);

    // 确保输出目录存在
    const outputDir = path.join(ROOT, config.outputDir);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const articles = [];
    const chapters = [];

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const cleanedTitle = cleanTitle(section.rawTitle);
        const sectionContent = section.lines.join('\n');

        // 生成文件名：courseId + 章节序号
        const filename = `${config.courseId}${i}.html`;
        const filepath = path.join(outputDir, filename);

        // Markdown → HTML
        const contentHtml = renderMarkdown(sectionContent);

        // 提取 TOC
        const sectionId = String(i);
        const toc = extractToc(contentHtml, sectionId);
        const tocHtml = renderTocHtml(toc, cleanedTitle);

        // 给 HTML 中的标题添加锚点
        const anchoredHtml = addAnchorsToHtml(contentHtml, sectionId);

        // 生成完整页面
        const pageHtml = articleTemplate(config, cleanedTitle, tocHtml, anchoredHtml, sectionId);

        fs.writeFileSync(filepath, pageHtml, 'utf-8');
        console.log(`  ✅ ${filename} → ${cleanedTitle}`);

        // 记录文章信息
        articles.push({
            title: cleanedTitle,
            url: `/${config.outputDir}/${filename}`,
            course: config.courseName,
            category: config.category
        });

        chapters.push({
            filename: filename,
            title: cleanedTitle
        });
    }

    // 生成课程主页
    const homepageHtml = homepageTemplate(config, chapters);
    const homepagePath = path.join(outputDir, 'homepage.html');
    fs.writeFileSync(homepagePath, homepageHtml, 'utf-8');
    console.log(`  ✅ homepage.html → ${config.courseName} 目录`);

    return articles;
}

// ============================================================
// articles.json 更新
// ============================================================

function updateArticlesJson(allArticles) {
    // 读取现有的 articles.json（保留非构建系统生成的条目）
    let existing = [];
    if (fs.existsSync(ARTICLES_JSON)) {
        try {
            existing = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf-8'));
        } catch (e) {
            console.warn('  ⚠️ articles.json 解析失败，将重新生成');
        }
    }

    // 获取本次构建涉及的课程名
    const builtCourses = new Set(allArticles.map(a => a.course));

    // 保留不在本次构建范围内的条目
    const kept = existing.filter(a => !builtCourses.has(a.course));

    // 合并
    const merged = [...kept, ...allArticles];

    fs.writeFileSync(ARTICLES_JSON, JSON.stringify(merged, null, 4), 'utf-8');
    console.log(`\n[索引] articles.json 已更新 (${merged.length} 篇文章)`);
}

// ============================================================
// 入口
// ============================================================

function main() {
    // 解析命令行参数
    const args = process.argv.slice(2);
    let filterCourseId = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--course' && args[i + 1]) {
            filterCourseId = args[i + 1];
        }
    }

    // 读取配置
    if (!fs.existsSync(CONFIG_FILE)) {
        console.error('❌ 未找到 build-config.json');
        process.exit(1);
    }

    const configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    const targetConfigs = filterCourseId
        ? configs.filter(c => c.courseId === filterCourseId)
        : configs;

    if (targetConfigs.length === 0) {
        console.error(`❌ 未找到课程: ${filterCourseId}`);
        process.exit(1);
    }

    console.log(`===== Markdown → HTML 构建 =====`);
    console.log(`待构建课程: ${targetConfigs.map(c => c.courseId).join(', ')}`);

    // 构建每门课
    let allArticles = [];
    for (const config of targetConfigs) {
        const articles = buildCourse(config);
        allArticles = allArticles.concat(articles);
    }

    // 更新 articles.json
    updateArticlesJson(allArticles);

    console.log(`\n===== 构建完成 =====`);
}

main();
