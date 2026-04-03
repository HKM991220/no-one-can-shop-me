/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function md5File(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buf).digest('hex');
}

function walk(dir, out = []) {
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
            continue;
        }
        out.push(full);
    }
    return out;
}

function toManifestAssetKey(rootDir, filePath) {
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
    return rel;
}

function parseCliArg(name, fallback) {
    const flag = `--${name}=`;
    const hit = process.argv.find((v) => v.startsWith(flag));
    if (!hit) {
        return fallback;
    }
    return hit.slice(flag.length);
}

function copyFileSyncSafe(from, to) {
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.copyFileSync(from, to);
}

function copyDirRecursive(fromDir, toDir) {
    if (!fs.existsSync(fromDir)) {
        return;
    }
    const entries = fs.readdirSync(fromDir, {withFileTypes: true});
    for (const entry of entries) {
        const src = path.join(fromDir, entry.name);
        const dst = path.join(toDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(src, dst);
            continue;
        }
        copyFileSyncSafe(src, dst);
    }
}

function resolvePlatformBuildDir(cfg, platform) {
    if (cfg.buildDirByPlatform && cfg.buildDirByPlatform[platform]) {
        return cfg.buildDirByPlatform[platform];
    }
    return cfg.buildDir;
}

function resolvePackageUrl(cfg, platform) {
    if (cfg.packageUrlByPlatform && cfg.packageUrlByPlatform[platform]) {
        return String(cfg.packageUrlByPlatform[platform]).replace(/\/+$/, '');
    }
    return String(cfg.packageUrl).replace(/\/+$/, '');
}

function buildOnePlatform(cfg, root, platform) {
    const buildDir = path.resolve(root, resolvePlatformBuildDir(cfg, platform));
    const outDir = path.resolve(root, cfg.outputDir, platform);
    const version = String(cfg.version);
    const packageUrl = resolvePackageUrl(cfg, platform);
    const remoteManifestUrl = `${packageUrl}/project.manifest`;
    const remoteVersionUrl = `${packageUrl}/version.manifest`;
    const includeDirs = Array.isArray(cfg.includeDirs) ? cfg.includeDirs : ['assets', 'src'];

    if (!fs.existsSync(buildDir)) {
        throw new Error(`[${platform}] build directory not found: ${buildDir}`);
    }
    fs.mkdirSync(outDir, {recursive: true});

    const assets = {};
    for (const d of includeDirs) {
        const abs = path.join(buildDir, d);
        if (!fs.existsSync(abs)) {
            continue;
        }
        for (const filePath of walk(abs)) {
            const key = toManifestAssetKey(buildDir, filePath);
            const stat = fs.statSync(filePath);
            assets[key] = {
                md5: md5File(filePath),
                size: stat.size,
            };
            if (key.endsWith('.zip')) {
                assets[key].compressed = true;
            }
        }
    }

    const projectManifest = {
        packageUrl,
        remoteManifestUrl,
        remoteVersionUrl,
        version,
        assets,
        searchPaths: [],
    };

    const versionManifest = {
        packageUrl,
        remoteManifestUrl,
        remoteVersionUrl,
        version,
    };

    writeJson(path.join(outDir, 'project.manifest'), projectManifest);
    writeJson(path.join(outDir, 'version.manifest'), versionManifest);

    const releaseRoot = cfg.releaseDir ? path.resolve(root, cfg.releaseDir) : null;
    if (releaseRoot) {
        const releaseDir = path.join(releaseRoot, version, platform);
        fs.mkdirSync(releaseDir, {recursive: true});
        for (const d of includeDirs) {
            copyDirRecursive(path.join(buildDir, d), path.join(releaseDir, d));
        }
        copyFileSyncSafe(path.join(outDir, 'project.manifest'), path.join(releaseDir, 'project.manifest'));
        copyFileSyncSafe(path.join(outDir, 'version.manifest'), path.join(releaseDir, 'version.manifest'));
        console.log(`[hotupdate] [${platform}] release package: ${releaseDir}`);
    }

    console.log(`[hotupdate] [${platform}] generated manifests: ${outDir}`);
    console.log(`[hotupdate] [${platform}] assets count: ${Object.keys(assets).length}`);
}

function main() {
    const root = process.cwd();
    const configPath = parseCliArg('config', path.join(root, 'scripts/hotupdate/config.json'));
    if (!fs.existsSync(configPath)) {
        throw new Error(`Hotupdate config not found: ${configPath}`);
    }

    const cfg = readJson(configPath);
    const platforms = Array.isArray(cfg.platforms) && cfg.platforms.length > 0
        ? cfg.platforms
        : ['android'];
    if (!cfg.outputDir) {
        throw new Error('outputDir is required in hotupdate config');
    }
    for (const platform of platforms) {
        buildOnePlatform(cfg, root, String(platform));
    }
}

try {
    main();
} catch (e) {
    console.error(`[hotupdate] ${e.message}`);
    process.exit(1);
}
