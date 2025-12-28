const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const minifyHtml = require('html-minifier').minify;

async function build() {
    console.log('🚀 Starting build...');
    const buildDir = path.join(__dirname, 'build');
    const docsDir = path.join(__dirname, 'docs');

    // 1. Clean and prepare build dir
    await fs.emptyDir(buildDir);
    console.log('🧹 Cleaned build directory');

    // 2. Copy static assets
    console.log('📂 Copying assets...');
    await fs.copy(path.join(docsDir, 'data'), path.join(buildDir, 'data'));
    await fs.copy(path.join(docsDir, 'manifest.json'), path.join(buildDir, 'manifest.json'));
    // Copy font/icons if local? They are CDNs in HTML. 
    // But we have local images if any? None visible in file list except bg_bbd.json in data.

    // 3. Build CSS
    console.log('🎨 Building CSS...');
    try {
        // Concatenate Tailwind directives with custom CSS to ensure correct order
        const indexCss = await fs.readFile(path.join(docsDir, 'index.css'), 'utf8');
        const cssInputContent = `
@tailwind base;
@tailwind components;
@tailwind utilities;

${indexCss}
`;
        const tempCssInput = path.join(__dirname, 'temp-input.css');
        await fs.writeFile(tempCssInput, cssInputContent);

        // Use PostCSS with NODE_ENV=production to trigger cssnano
        execSync(`NODE_ENV=production ./node_modules/.bin/postcss ${tempCssInput} -o ./build/styles.css`, { stdio: 'inherit' });

        await fs.remove(tempCssInput);
    } catch (e) {
        console.error('Failed to build CSS', e);
        process.exit(1);
    }

    // 4. Bundle JS
    console.log('📦 Bundling JS...');

    // Create a temporary entry point to include Fuse.js
    const tempEntry = path.join(__dirname, 'temp-entry.js');
    const entryContent = `
        import Fuse from 'fuse.js';
        window.Fuse = Fuse;
        import './docs/app.js';
    `;
    await fs.writeFile(tempEntry, entryContent);

    try {
        await esbuild.build({
            entryPoints: [tempEntry],
            bundle: true,
            minify: true,
            outfile: path.join(buildDir, 'app.js'),
            sourcemap: true,
        });

        // Build Service Worker separately
        await esbuild.build({
            entryPoints: [path.join(docsDir, 'sw.js')],
            bundle: true,
            minify: true,
            outfile: path.join(buildDir, 'sw.js'),
        });

    } catch (e) {
        console.error('JS Bundle failed', e);
        process.exit(1);
    } finally {
        await fs.remove(tempEntry);
    }

    // 5. Process HTML
    console.log('📄 Processing HTML...');
    let html = await fs.readFile(path.join(docsDir, 'index.html'), 'utf8');

    // Remove Tailwind CDN and Config
    html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, '');
    html = html.replace(/<script>\s*tailwind\.config\s*=\s*{[\s\S]*?}\s*<\/script>/, '');

    // Remove Fuse CDN (bundled now)
    html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/fuse\.js@7\.0\.0"><\/script>/, '');

    // Add preload for versions.json to fix network chain latency
    const preloadLink = '<link rel="preload" href="data/versions.json" as="fetch" crossorigin>';
    html = html.replace('</head>', `${preloadLink}</head>`);

    // Inline CSS for performance (avoids render blocking request)
    try {
        const styles = await fs.readFile(path.join(buildDir, 'styles.css'), 'utf8');
        html = html.replace('</head>', `<style>${styles}</style></head>`);
        // We don't need styles.css in build anymore if inlined, but good to keep or delete.
        // Let's delete it to be clean if we strictly inline.
        await fs.remove(path.join(buildDir, 'styles.css'));
    } catch (e) {
        console.warn('Could not inline CSS, falling back to link', e);
        html = html.replace('</head>', '<link rel="stylesheet" href="styles.css"></head>');
    }

    // Replace index.css link with nothing (we use styles.css or inline)
    html = html.replace('<link rel="stylesheet" href="index.css">', '');

    // Minify HTML
    const minifiedHtml = minifyHtml(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: false // Already minified by PostCSS, avoid clean-css corrupting Tailwind selectors
    });

    await fs.writeFile(path.join(buildDir, 'index.html'), minifiedHtml);

    console.log('✅ Build complete! Output in ./build');
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
