/**
 * 从 Google Fonts 下载 Noto Sans 字体子集，保存到本地
 *
 * 参考自: https://github.com/itorr/china-ex (US version: us-level)
 */

const { readFileSync, writeFileSync } = require('fs');
const axios = require('axios');

// 收集所有用到的字符
const getTextFromFile = (filename) => {
    let content = readFileSync(filename, 'utf8');
    const texts = [];

    const addTextFromMatch = (all, text) => {
        text = text.replace(/<.+?>/g, '');
        texts.push(text);
        return '';
    };

    content = content.replace(/<(?:path|rect) id="(.+?)"/g, addTextFromMatch);
    content = content.replace(/<text .+?>(.+?)<\/text>/g, addTextFromMatch);
    content = content.replace(/<a .+?>(.+?)<\/a>/g, addTextFromMatch);
    content = content.replace(/<h2 .+?>(.+?)<\/h2>/g, addTextFromMatch);
    content = content.replace(/<p>([\s\S]+?)<\/p>/g, addTextFromMatch);

    return texts.join('');
};

// 收集所有字符
const allText = getTextFromFile('html/index.html') + getTextFromFile('netherlands-label.svg');
const uniqueChars = [...new Set(allText.replace(/\s/g, '').split(''))].sort().join('');
console.log(`Characters (${uniqueChars.length}): ${uniqueChars}`);

// 构建 Google Fonts API URL (带 text 参数做子集化)
const fontFamily = 'Noto+Sans';
const weights = 'wght@400;700';
const googleFontsURL = `https://fonts.googleapis.com/css2?family=${fontFamily}:${weights}&text=${encodeURIComponent(uniqueChars)}`;

const downloadFont = async () => {
    // Step 1: 获取 Google Fonts CSS
    console.log('Fetching Google Fonts CSS...');
    const cssResponse = await axios.get(googleFontsURL, {
        headers: {
            // 模拟浏览器 UA 以获取 woff2 格式
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const cssText = cssResponse.data;
    console.log('CSS received.');

    // Step 2: 从 CSS 中提取字体文件 URL
    const urlMatches = [...cssText.matchAll(/url\((https:\/\/[^)]+)\)/g)];
    const fontURLs = urlMatches.map(m => m[1]);

    if (fontURLs.length === 0) {
        console.error('No font URLs found in CSS');
        return;
    }

    console.log(`Found ${fontURLs.length} font file(s).`);

    // Step 3: 下载字体文件并合并
    const fontBuffers = [];
    for (const url of fontURLs) {
        console.log(`Downloading: ${url.substring(0, 80)}...`);
        const fontResponse = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        fontBuffers.push(Buffer.from(fontResponse.data));
        console.log(`  Downloaded ${fontBuffers[fontBuffers.length - 1].length} bytes.`);
    }

    // Step 4: 写入字体文件并生成对应的 CSS
    // 将多个 weight 的 font 保存为单独文件
    const weights_match = [...cssText.matchAll(/font-weight:\s*(\d+)/g)];

    if (fontBuffers.length >= 2) {
        writeFileSync('html/slice-400.woff2', fontBuffers[0]);
        writeFileSync('html/slice-700.woff2', fontBuffers[1]);
        console.log('Saved: html/slice-400.woff2, html/slice-700.woff2');
    } else if (fontBuffers.length === 1) {
        writeFileSync('html/slice.woff2', fontBuffers[0]);
        console.log('Saved: html/slice.woff2');
    }

    // Step 5: 生成本地 @font-face CSS
    let localCSS = '';
    if (fontBuffers.length >= 2) {
        localCSS += `@font-face{font-family:'Noto Sans';font-weight:400;src:url(slice-400.woff2) format('woff2')}\n`;
        localCSS += `@font-face{font-family:'Noto Sans';font-weight:700;src:url(slice-700.woff2) format('woff2')}\n`;
    } else {
        localCSS += `@font-face{font-family:'Noto Sans';src:url(slice.woff2) format('woff2')}\n`;
    }
    writeFileSync('html/slice.css', localCSS);
    console.log('Saved: html/slice.css');

    console.log('\nDone! Font files ready.');
};

downloadFont().catch(err => {
    console.error('Font download failed:', err.message);
    process.exit(1);
});
