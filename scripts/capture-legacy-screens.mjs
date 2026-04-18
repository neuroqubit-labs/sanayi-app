import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const REPO_ROOT = process.cwd();
const OUTPUT_ROOT = path.join(REPO_ROOT, 'docs', 'reference-screens', 'legacy');
const EXPECTED_SCREEN_COUNT = 52;

const APPS = [
    {
        key: 'owner',
        actor: 'arac-sahibi',
        url: 'http://127.0.0.1:5200',
        cwd: path.join(REPO_ROOT, 'legacy', 'app'),
    },
    {
        key: 'usta',
        actor: 'usta',
        url: 'http://127.0.0.1:5201',
        cwd: path.join(REPO_ROOT, 'legacy', 'usta-app'),
    },
];

const ACTOR_LABELS = {
    'arac-sahibi': 'Araç Sahibi',
    usta: 'Usta',
};

const GROUP_LABELS = {
    'arac-sahibi': {
        '00-overlays': 'Overlay Ekranlar',
        '01-main-tabs': 'Ana Sekmeler',
        '02-discovery-match': 'Keşif ve Eşleşme',
        '03-request-flows': 'Talep Akışları',
        '04-case-and-offers': 'Vaka ve Teklifler',
        '05-vehicles': 'Araçlar',
        '06-search-and-purchase': 'Arama ve Satın Alma',
        '07-utility': 'Yardımcı Ekranlar',
    },
    usta: {
        '00-overlays': 'Overlay Ekranlar',
        '01-main-tabs': 'Ana Sekmeler',
        '02-job-pool': 'İş ve Havuz Akışları',
        '03-revenue-campaigns': 'Gelir ve Kampanyalar',
    },
};

function sortPresets(presets) {
    return [...presets].sort((left, right) => {
        if (left.actor !== right.actor) return left.actor.localeCompare(right.actor);
        if (left.group !== right.group) return left.group.localeCompare(right.group);
        return left.order.localeCompare(right.order);
    });
}

function log(message) {
    console.log(`[capture] ${message}`);
}

function startServer(app) {
    const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
        cwd: app.cwd,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const pushLog = (chunk) => {
        const text = chunk.toString();
        output = `${output}${text}`.slice(-4000);
    };

    child.stdout.on('data', pushLog);
    child.stderr.on('data', pushLog);

    child.on('exit', (code, signal) => {
        if (code !== 0 && signal !== 'SIGTERM') {
            console.error(`[capture] ${app.key} dev server exited early (${signal || code})`);
            if (output.trim()) console.error(output.trim());
        }
    });

    return {
        child,
        getOutput: () => output,
    };
}

async function stopServer(server) {
    if (!server || server.child.exitCode !== null) return;

    try {
        process.kill(-server.child.pid, 'SIGTERM');
    } catch {
        server.child.kill('SIGTERM');
    }

    await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        server.child.once('exit', () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

async function waitForServer(app, server, timeoutMs = 60000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (server.child.exitCode !== null) {
            throw new Error(`${app.key} dev server exited before becoming ready.\n${server.getOutput()}`);
        }

        try {
            const response = await fetch(app.url, { redirect: 'manual' });
            if (response.ok || response.status === 404) {
                return;
            }
        } catch {
            // Keep polling until timeout.
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`${app.key} dev server did not become ready within ${timeoutMs}ms.\n${server.getOutput()}`);
}

async function loadPresets(page, app) {
    await page.goto(app.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Array.isArray(window.__LEGACY_CAPTURE_MANIFEST__) && window.__LEGACY_CAPTURE_MANIFEST__.length > 0);
    const presets = await page.evaluate(() => window.__LEGACY_CAPTURE_MANIFEST__);
    return presets.map((preset) => ({ ...preset, baseUrl: app.url }));
}

async function ensureDirFor(filePath) {
    await mkdir(path.dirname(filePath), { recursive: true });
}

function toPosix(relativePath) {
    return relativePath.split(path.sep).join('/');
}

async function capturePreset(page, preset) {
    const targetUrl = `${preset.baseUrl}/?capture=${encodeURIComponent(preset.id)}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(
        ({ presetId }) => {
            const shell = document.querySelector('.app-shell');
            return (
                document.documentElement.dataset.capturePreset === presetId &&
                shell
            );
        },
        { presetId: preset.id }
    );

    const shell = page.locator('.app-shell');
    await shell.waitFor({ state: 'visible' });
    await page.waitForTimeout(150);

    const absoluteOutputPath = path.join(REPO_ROOT, preset.outputPath);
    await ensureDirFor(absoluteOutputPath);
    await shell.screenshot({
        path: absoluteOutputPath,
        animations: 'disabled',
    });

    const renderedScreenId = await page.evaluate(() => {
        return document.querySelector('.app-shell')?.dataset.captureScreen || null;
    });

    return {
        ...preset,
        captureUrl: targetUrl,
        renderedScreenId,
    };
}

function buildManifest(entries) {
    return {
        generatedAt: new Date().toISOString(),
        totalCount: entries.length,
        entries: entries.map((entry) => ({
            id: entry.id,
            actor: entry.actor,
            group: entry.group,
            order: entry.order,
            title: entry.title,
            screenId: entry.screenId,
            renderedScreenId: entry.renderedScreenId,
            captureMode: entry.captureMode,
            outputPath: entry.outputPath,
            captureUrl: entry.captureUrl,
        })),
    };
}

function buildReadme(entries) {
    const lines = [
        '# Legacy Referans Ekranlari',
        '',
        `Toplam ekran: ${entries.length}`,
        '',
    ];

    for (const app of APPS) {
        const actorEntries = entries.filter((entry) => entry.actor === app.actor);
        if (actorEntries.length === 0) continue;

        lines.push(`## ${ACTOR_LABELS[app.actor] || app.actor}`);
        lines.push('');

        const groups = [...new Set(actorEntries.map((entry) => entry.group))];
        for (const group of groups) {
            lines.push(`### ${GROUP_LABELS[app.actor]?.[group] || group}`);
            lines.push('');

            const groupEntries = actorEntries.filter((entry) => entry.group === group);
            for (const entry of groupEntries) {
                lines.push(`- [${path.basename(entry.outputPath)}](./${toPosix(entry.outputPath.replace('docs/reference-screens/legacy/', ''))}) — ${entry.title}`);
            }

            lines.push('');
        }
    }

    return lines.join('\n');
}

async function main() {
    await rm(OUTPUT_ROOT, { recursive: true, force: true });
    await mkdir(OUTPUT_ROOT, { recursive: true });

    const ownerServer = startServer(APPS[0]);
    const ustaServer = startServer(APPS[1]);

    let browser;

    try {
        log('Dev serverlar baslatiliyor');
        await Promise.all([
            waitForServer(APPS[0], ownerServer),
            waitForServer(APPS[1], ustaServer),
        ]);

        browser = await chromium.launch({ headless: true });

        log('Preset manifestleri yukleniyor');
        const presetGroups = [];
        for (const app of APPS) {
            const manifestPage = await browser.newPage({ viewport: { width: 520, height: 1200 } });
            try {
                presetGroups.push(await loadPresets(manifestPage, app));
            } finally {
                await manifestPage.close();
            }
        }
        const presets = sortPresets(presetGroups.flat());

        if (presets.length !== EXPECTED_SCREEN_COUNT) {
            throw new Error(`Expected ${EXPECTED_SCREEN_COUNT} capture presets, received ${presets.length}.`);
        }

        log(`${presets.length} ekran capture edilecek`);
        const capturedEntries = [];
        const page = await browser.newPage({ viewport: { width: 520, height: 1600 } });

        for (const preset of presets) {
            log(`Capture: ${preset.id}`);
            const captured = await capturePreset(page, preset);
            capturedEntries.push(captured);
        }

        const manifest = buildManifest(capturedEntries);
        const readme = buildReadme(capturedEntries);

        await writeFile(path.join(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        await writeFile(path.join(OUTPUT_ROOT, 'README.md'), `${readme}\n`, 'utf8');

        log(`Tamamlandi: ${capturedEntries.length} PNG, manifest ve README yazildi`);
    } finally {
        if (browser) await browser.close();
        await Promise.all([
            stopServer(ownerServer),
            stopServer(ustaServer),
        ]);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
