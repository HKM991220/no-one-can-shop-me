/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function parseCliArg(name, fallback) {
    const flag = `--${name}=`;
    const hit = process.argv.find((v) => v.startsWith(flag));
    if (!hit) {
        return fallback;
    }
    return hit.slice(flag.length);
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function copyFileSyncSafe(from, to) {
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.copyFileSync(from, to);
}

function main() {
    const root = process.cwd();
    const configPath = parseCliArg('config', path.join(root, 'scripts/hotupdate/config.json'));
    const platform = parseCliArg('platform', 'android');
    const targetDir = parseCliArg('target', path.join(root, 'assets/resources/hotupdate'));
    if (!fs.existsSync(configPath)) {
        throw new Error(`hotupdate config not found: ${configPath}`);
    }
    const cfg = readJson(configPath);
    const outDir = path.resolve(root, cfg.outputDir, platform);
    const projectManifest = path.join(outDir, 'project.manifest');
    const versionManifest = path.join(outDir, 'version.manifest');
    if (!fs.existsSync(projectManifest) || !fs.existsSync(versionManifest)) {
        throw new Error(`manifest files not found in: ${outDir}`);
    }
    copyFileSyncSafe(projectManifest, path.join(targetDir, 'project.manifest'));
    copyFileSyncSafe(versionManifest, path.join(targetDir, 'version.manifest'));
    console.log(`[hotupdate] embedded manifests synced from ${outDir}`);
}

try {
    main();
} catch (e) {
    console.error(`[hotupdate] ${e.message}`);
    process.exit(1);
}
